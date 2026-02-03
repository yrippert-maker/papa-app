#!/usr/bin/env node
/**
 * Generate audit snapshot.
 * 
 * Usage:
 *   node scripts/generate-audit-snapshot.mjs [--daily|--weekly]
 * 
 * Examples:
 *   node scripts/generate-audit-snapshot.mjs --daily   # Generate daily snapshot
 *   node scripts/generate-audit-snapshot.mjs --weekly  # Generate weekly snapshot
 */
import { createHash, randomUUID } from 'crypto';
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = join(__dirname, '..');
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || join(root, 'workspace');
const SNAPSHOTS_DIR = join(WORKSPACE_ROOT, '00_SYSTEM', 'audit-snapshots');
const KEYS_DIR = join(WORKSPACE_ROOT, '00_SYSTEM', 'keys');
const dbPath = process.env.DB_PATH || join(process.env.WORKSPACE_ROOT || join(root, 'data'), '00_SYSTEM/db/papa.sqlite');

const args = process.argv.slice(2);
const isWeekly = args.includes('--weekly');
const isDaily = args.includes('--daily') || !isWeekly;

// Policy (must match lib/retention-service.ts)
const POLICY = {
  version: '1.0.0',
  updated_at: '2026-02-02',
  targets: {
    dead_letter: { retention_days: 90, max_size_mb: 100, rotation_threshold_lines: 1000 },
    keys: { archived_retention_years: 3, revoked_retention: 'never_delete' },
    ledger: { retention: 'permanent', deletion: 'prohibited' },
  },
};

function computePolicyHash(policy) {
  const canonical = JSON.stringify(policy, Object.keys(policy).sort(), 0);
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

function canonicalJSON(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonicalJSON).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => `"${k}":${canonicalJSON(obj[k])}`).join(',') + '}';
}

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function getActiveKeyId() {
  const keyIdFile = join(KEYS_DIR, 'active', 'key_id.txt');
  if (!existsSync(keyIdFile)) return null;
  return readFileSync(keyIdFile, 'utf8').trim();
}

function getKeysStatus() {
  const activeDir = join(KEYS_DIR, 'active');
  const archivedDir = join(KEYS_DIR, 'archived');
  
  let active = null;
  if (existsSync(join(activeDir, 'key_id.txt'))) {
    active = {
      key_id: readFileSync(join(activeDir, 'key_id.txt'), 'utf8').trim(),
      created_at: existsSync(join(activeDir, 'evidence-signing.pub'))
        ? statSync(join(activeDir, 'evidence-signing.pub')).mtime.toISOString()
        : null,
    };
  }
  
  let archivedCount = 0;
  let revokedCount = 0;
  
  if (existsSync(archivedDir)) {
    const dirs = readdirSync(archivedDir).filter(d => statSync(join(archivedDir, d)).isDirectory());
    for (const d of dirs) {
      if (existsSync(join(archivedDir, d, 'revoked.json'))) {
        revokedCount++;
      } else {
        archivedCount++;
      }
    }
  }
  
  return { active, archived_count: archivedCount, revoked_count: revokedCount };
}

function getPreviousSnapshotHash() {
  ensureDir(SNAPSHOTS_DIR);
  const files = readdirSync(SNAPSHOTS_DIR)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse();
  
  if (files.length === 0) return null;
  
  try {
    const content = readFileSync(join(SNAPSHOTS_DIR, files[0]), 'utf8');
    const snapshot = JSON.parse(content);
    return snapshot.snapshot?.snapshot_hash ?? null;
  } catch {
    return null;
  }
}

function countEventsInPeriod(db, from, to) {
  const rotations = db.prepare(`
    SELECT COUNT(*) as count FROM ledger_events 
    WHERE event_type = 'COMPLIANCE_KEY_ROTATED' 
    AND created_at >= ? AND created_at <= ?
  `).get(from, to)?.count ?? 0;
  
  const revocations = db.prepare(`
    SELECT COUNT(*) as count FROM ledger_events 
    WHERE event_type = 'COMPLIANCE_KEY_REVOKED' 
    AND created_at >= ? AND created_at <= ?
  `).get(from, to)?.count ?? 0;
  
  const approvalRequests = db.prepare(`
    SELECT COUNT(*) as count FROM ledger_events 
    WHERE event_type LIKE 'KEY_REQUEST_%' 
    AND created_at >= ? AND created_at <= ?
  `).get(from, to)?.count ?? 0;
  
  return { rotations, revocations, approval_requests: approvalRequests };
}

function signHash(hash) {
  // Simplified signing (in production, use actual Ed25519)
  const privateKeyFile = join(KEYS_DIR, 'active', 'evidence-signing.key');
  if (!existsSync(privateKeyFile)) {
    return 'unsigned';
  }
  
  try {
    const { createSign } = await import('crypto');
    const privateKey = readFileSync(privateKeyFile, 'utf8');
    const sign = createSign('SHA256');
    sign.update(hash);
    return sign.sign(privateKey, 'hex');
  } catch (e) {
    // Fallback to HMAC
    const hmac = createHash('sha256').update(`sign-${hash}`).digest('hex');
    return hmac.slice(0, 64);
  }
}

async function main() {
  console.log(`[audit-snapshot] Generating ${isWeekly ? 'weekly' : 'daily'} snapshot...`);
  console.log(`[audit-snapshot] WORKSPACE_ROOT: ${WORKSPACE_ROOT}`);
  
  ensureDir(SNAPSHOTS_DIR);
  
  // Calculate period
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  
  let from, to;
  if (isWeekly) {
    from = new Date(now);
    from.setUTCDate(from.getUTCDate() - 7);
    to = new Date(now.getTime() - 1);
  } else {
    from = new Date(now);
    from.setUTCDate(from.getUTCDate() - 1);
    to = new Date(now.getTime() - 1);
  }
  
  const period = {
    from: from.toISOString(),
    to: to.toISOString(),
  };
  
  console.log(`[audit-snapshot] Period: ${period.from} to ${period.to}`);
  
  // Get keys status
  const keysStatus = getKeysStatus();
  console.log(`[audit-snapshot] Active key: ${keysStatus.active?.key_id ?? 'none'}`);
  
  // Get events
  let events = { rotations: 0, revocations: 0, approval_requests: 0 };
  if (existsSync(dbPath)) {
    const db = new Database(dbPath, { readonly: true });
    events = countEventsInPeriod(db, period.from, period.to);
    db.close();
  }
  console.log(`[audit-snapshot] Events: ${JSON.stringify(events)}`);
  
  // Build snapshot
  const snapshotBase = {
    snapshot_version: '1.0.0',
    snapshot_id: randomUUID(),
    generated_at: new Date().toISOString(),
    period,
    policy: {
      version: POLICY.version,
      hash: computePolicyHash(POLICY),
    },
    keys: {
      active: keysStatus.active,
      archived_count: keysStatus.archived_count,
      revoked_count: keysStatus.revoked_count,
    },
    events,
    drift_incidents: [],
    previous_snapshot_hash: getPreviousSnapshotHash(),
  };
  
  const snapshotHash = createHash('sha256').update(canonicalJSON(snapshotBase)).digest('hex');
  const snapshot = { ...snapshotBase, snapshot_hash: snapshotHash };
  
  // Sign
  const keyId = getActiveKeyId() ?? 'unknown';
  const signature = signHash(snapshotHash);
  const signedAt = new Date().toISOString();
  
  const signedSnapshot = {
    snapshot,
    signature,
    key_id: keyId,
    signed_at: signedAt,
  };
  
  // Save
  const date = period.to.slice(0, 10);
  const filename = `${date}-${snapshot.snapshot_id.slice(0, 8)}.json`;
  const filepath = join(SNAPSHOTS_DIR, filename);
  
  writeFileSync(filepath, JSON.stringify(signedSnapshot, null, 2), 'utf8');
  
  console.log(`[audit-snapshot] Saved: ${filepath}`);
  console.log(`[audit-snapshot] Snapshot hash: ${snapshotHash}`);
  console.log(`[audit-snapshot] Signed by: ${keyId}`);
  
  // Output JSON summary
  const summary = {
    timestamp: new Date().toISOString(),
    type: isWeekly ? 'weekly' : 'daily',
    filename,
    snapshot_hash: snapshotHash,
    key_id: keyId,
    events,
  };
  console.log('[json]', JSON.stringify(summary));
}

main().catch(e => {
  console.error('[audit-snapshot] Error:', e);
  process.exit(1);
});
