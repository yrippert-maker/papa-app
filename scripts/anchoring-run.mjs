#!/usr/bin/env node
/**
 * anchoring:run — создаёт anchor (Merkle root) за период.
 * Вызывать ежедневно из governance-cadence или launchd/cron.
 *
 * Usage:
 *   node scripts/anchoring-run.mjs
 *   node scripts/anchoring-run.mjs --period 2026-02-01
 */
import Database from 'better-sqlite3';
import { createHash } from 'crypto';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || join(ROOT, 'data');
const DB_PATH = join(WORKSPACE_ROOT, '00_SYSTEM', 'db', 'papa.sqlite');

// Deterministic: sort leaves lexicographically; hash(min||max)
function buildMerkleRoot(hashes) {
  if (hashes.length === 0) return createHash('sha256').update('').digest('hex');
  const sorted = [...hashes].sort((a, b) => a.localeCompare(b));
  let level = sorted.map((h) => Buffer.from(h, 'hex'));
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : left;
      const [lo, hi] = Buffer.compare(left, right) <= 0 ? [left, right] : [right, left];
      next.push(createHash('sha256').update(Buffer.concat([lo, hi])).digest());
    }
    level = next;
  }
  return level[0].toString('hex');
}

const args = process.argv.slice(2);
const periodIdx = args.indexOf('--period');
const periodArg = periodIdx >= 0 ? args[periodIdx + 1] : null;

const now = new Date();
const periodDate = periodArg ? new Date(periodArg) : new Date(now.getTime() - 24 * 60 * 60 * 1000);
const periodStart = periodDate.toISOString().slice(0, 10) + 'T00:00:00.000Z';
const periodEnd = periodDate.toISOString().slice(0, 10) + 'T23:59:59.999Z';

const db = new Database(DB_PATH);

// Idempotent: skip if anchor for period already exists
const existing = db.prepare(
  `SELECT id FROM ledger_anchors WHERE period_start = ? AND period_end = ? AND status IN ('pending','confirmed','empty') LIMIT 1`
).get(periodStart, periodEnd);
if (existing) {
  console.log('[anchoring] Anchor already exists:', existing.id);
  db.close();
  process.exit(0);
}

const events = db.prepare(
  `SELECT id, block_hash FROM ledger_events WHERE created_at >= ? AND created_at < ? AND block_hash IS NOT NULL ORDER BY id`
).all(periodStart, periodEnd);

const hashes = events.map((e) => e.block_hash);
const id = `anchor-${randomUUID().slice(0, 8)}`;

if (events.length === 0) {
  // Empty period: status=empty, merkle_root=null — no publish
  db.prepare(
    `INSERT INTO ledger_anchors (id, period_start, period_end, merkle_root, status, events_count) VALUES (?, ?, ?, NULL, 'empty', 0)`
  ).run(id, periodStart, periodEnd);
  console.log('[anchoring] Created empty anchor:', id);
  console.log('[anchoring] Period:', periodStart, '-', periodEnd);
  console.log('[anchoring] Events: 0 (no publish)');
} else {
  const merkleRoot = buildMerkleRoot(hashes);
  db.prepare(
    `INSERT INTO ledger_anchors (id, period_start, period_end, merkle_root, status, events_count) VALUES (?, ?, ?, ?, 'pending', ?)`
  ).run(id, periodStart, periodEnd, merkleRoot, events.length);
  console.log('[anchoring] Created anchor:', id);
  console.log('[anchoring] Period:', periodStart, '-', periodEnd);
  console.log('[anchoring] Events:', events.length);
  console.log('[anchoring] Merkle root:', merkleRoot);
}
db.close();
