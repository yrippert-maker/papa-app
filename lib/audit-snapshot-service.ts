/**
 * Audit Snapshot Service
 * Generates periodic signed snapshots for compliance auditing.
 */
import { createHash, randomUUID } from 'crypto';
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { WORKSPACE_ROOT } from './config';
import { getKeysStatus } from './compliance-service';
import { getKeyAuditEvents } from './compliance-service';
import { signExportHash, getActiveKeyId } from './evidence-signing';
import { RETENTION_POLICY, computePolicyHash } from './retention-service';
import { getDbReadOnly, dbGet } from './db';
import { canonicalJSON } from './ledger-hash';

const SNAPSHOTS_DIR = join(WORKSPACE_ROOT, '00_SYSTEM', 'audit-snapshots');

export type SnapshotPeriod = {
  from: string;
  to: string;
};

export type AuditSnapshot = {
  snapshot_version: string;
  snapshot_id: string;
  generated_at: string;
  period: SnapshotPeriod;
  policy: {
    version: string;
    hash: string;
  };
  keys: {
    active: { key_id: string; created_at: string | null } | null;
    archived_count: number;
    revoked_count: number;
  };
  events: {
    rotations: number;
    revocations: number;
    approval_requests: number;
  };
  drift_incidents: string[];
  previous_snapshot_hash: string | null;
  snapshot_hash: string;
};

export type SignedSnapshot = {
  snapshot: AuditSnapshot;
  signature: string;
  key_id: string;
  signed_at: string;
};

/**
 * Ensures snapshots directory exists.
 */
function ensureSnapshotsDir(): void {
  if (!existsSync(SNAPSHOTS_DIR)) {
    mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  }
}

/**
 * Gets the hash of the previous snapshot for chaining.
 */
function getPreviousSnapshotHash(): string | null {
  ensureSnapshotsDir();
  const files = readdirSync(SNAPSHOTS_DIR)
    .filter(f => f.endsWith('.json') && !f.endsWith('.sig.json'))
    .sort()
    .reverse();
  
  if (files.length === 0) return null;
  
  try {
    const content = readFileSync(join(SNAPSHOTS_DIR, files[0]), 'utf8');
    const snapshot = JSON.parse(content) as SignedSnapshot;
    return snapshot.snapshot.snapshot_hash;
  } catch {
    return null;
  }
}

/**
 * Counts events in a period from the ledger.
 */
async function countEventsInPeriod(period: SnapshotPeriod): Promise<{ rotations: number; revocations: number; approval_requests: number }> {
  const db = await getDbReadOnly();
  
  const rotations = (await dbGet(db, `
    SELECT COUNT(*) as count FROM ledger_events 
    WHERE event_type = 'COMPLIANCE_KEY_ROTATED' 
    AND created_at >= ? AND created_at <= ?
  `, period.from, period.to)) as { count: number };
  
  const revocations = (await dbGet(db, `
    SELECT COUNT(*) as count FROM ledger_events 
    WHERE event_type = 'COMPLIANCE_KEY_REVOKED' 
    AND created_at >= ? AND created_at <= ?
  `, period.from, period.to)) as { count: number };
  
  const approvalRequests = (await dbGet(db, `
    SELECT COUNT(*) as count FROM ledger_events 
    WHERE event_type LIKE 'KEY_REQUEST_%' 
    AND created_at >= ? AND created_at <= ?
  `, period.from, period.to)) as { count: number };
  
  return {
    rotations: rotations.count,
    revocations: revocations.count,
    approval_requests: approvalRequests.count,
  };
}

/**
 * Computes snapshot hash.
 */
function computeSnapshotHash(snapshot: Omit<AuditSnapshot, 'snapshot_hash'>): string {
  const canonical = canonicalJSON(snapshot as Record<string, unknown>);
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Generates an audit snapshot for a period.
 */
export async function generateSnapshot(period: SnapshotPeriod): Promise<SignedSnapshot> {
  ensureSnapshotsDir();
  
  const keysStatus = getKeysStatus();
  const events = await countEventsInPeriod(period);
  const previousHash = getPreviousSnapshotHash();
  
  const snapshotBase: Omit<AuditSnapshot, 'snapshot_hash'> = {
    snapshot_version: '1.0.0',
    snapshot_id: randomUUID(),
    generated_at: new Date().toISOString(),
    period,
    policy: {
      version: RETENTION_POLICY.version,
      hash: computePolicyHash(RETENTION_POLICY),
    },
    keys: {
      active: keysStatus.active ? {
        key_id: keysStatus.active.key_id,
        created_at: keysStatus.active.created_at ?? null,
      } : null,
      archived_count: keysStatus.archived.filter(k => k.status === 'archived').length,
      revoked_count: keysStatus.archived.filter(k => k.status === 'revoked').length,
    },
    events,
    drift_incidents: [], // TODO: collect from alerts
    previous_snapshot_hash: previousHash,
  };
  
  const snapshotHash = computeSnapshotHash(snapshotBase);
  const snapshot: AuditSnapshot = {
    ...snapshotBase,
    snapshot_hash: snapshotHash,
  };
  
  // Sign the snapshot
  const { signature, keyId } = signExportHash(snapshotHash);
  const signedAt = new Date().toISOString();
  
  const signedSnapshot: SignedSnapshot = {
    snapshot,
    signature,
    key_id: keyId,
    signed_at: signedAt,
  };
  
  return signedSnapshot;
}

/**
 * Saves a snapshot to disk.
 */
export function saveSnapshot(signedSnapshot: SignedSnapshot): string {
  ensureSnapshotsDir();
  
  const date = signedSnapshot.snapshot.period.to.slice(0, 10);
  const filename = `${date}-${signedSnapshot.snapshot.snapshot_id.slice(0, 8)}.json`;
  const filepath = join(SNAPSHOTS_DIR, filename);
  
  writeFileSync(filepath, JSON.stringify(signedSnapshot, null, 2), 'utf8');
  
  return filepath;
}

/**
 * Generates and saves a daily snapshot.
 */
export async function generateDailySnapshot(date?: Date): Promise<string> {
  const d = date ?? new Date();
  d.setUTCHours(0, 0, 0, 0);
  
  const from = new Date(d);
  from.setUTCDate(from.getUTCDate() - 1);
  
  const period: SnapshotPeriod = {
    from: from.toISOString(),
    to: new Date(d.getTime() - 1).toISOString(),
  };
  
  const snapshot = await generateSnapshot(period);
  return saveSnapshot(snapshot);
}

/**
 * Generates and saves a weekly snapshot.
 */
export async function generateWeeklySnapshot(date?: Date): Promise<string> {
  const d = date ?? new Date();
  d.setUTCHours(0, 0, 0, 0);
  
  const to = new Date(d);
  const from = new Date(d);
  from.setUTCDate(from.getUTCDate() - 7);
  
  const period: SnapshotPeriod = {
    from: from.toISOString(),
    to: new Date(to.getTime() - 1).toISOString(),
  };
  
  const snapshot = await generateSnapshot(period);
  return saveSnapshot(snapshot);
}

/**
 * Lists all snapshots.
 */
export function listSnapshots(): Array<{ filename: string; date: string; snapshot_id: string }> {
  ensureSnapshotsDir();
  
  const files = readdirSync(SNAPSHOTS_DIR)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse();
  
  return files.map(f => {
    const date = f.slice(0, 10);
    const snapshot_id = f.slice(11, 19);
    return { filename: f, date, snapshot_id };
  });
}

/**
 * Reads a snapshot by filename.
 */
export function readSnapshot(filename: string): SignedSnapshot | null {
  const filepath = join(SNAPSHOTS_DIR, filename);
  if (!existsSync(filepath)) return null;
  
  try {
    const content = readFileSync(filepath, 'utf8');
    return JSON.parse(content) as SignedSnapshot;
  } catch {
    return null;
  }
}
