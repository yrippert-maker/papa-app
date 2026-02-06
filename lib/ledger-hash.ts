import crypto from 'crypto';
import { getDb, dbGet, dbRun } from './db';

/** Canonical JSON for hash input (sorted keys, no whitespace). */
export function canonicalJSON(obj: Record<string, unknown>): string {
  return JSON.stringify(obj, Object.keys(obj).sort());
}

/**
 * Compute ledger event hash (normative format with ts_utc and actor_id).
 * See docs/AUDIT_LOG_SCHEMA.md §4.
 */
export function computeEventHash({
  prev_hash,
  event_type,
  ts_utc,
  actor_id,
  canonical_payload_json,
}: {
  prev_hash: string | null;
  event_type: string;
  ts_utc: string;
  actor_id: string;
  canonical_payload_json: string;
}): string {
  const prev = prev_hash ?? '';
  const actor = actor_id ?? '';
  const input = `${event_type}\n${ts_utc}\n${actor}\n${canonical_payload_json}\n${prev}`;
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

/** Legacy formula (actor_id null): for verifying rows created before ts_utc/actor_id norm. */
function computeEventHashLegacy({
  prev_hash,
  event_type,
  canonical_payload_json,
}: {
  prev_hash: string | null;
  event_type: string;
  canonical_payload_json: string;
}): string {
  const prev = prev_hash ?? '';
  const input = `${event_type}\n${canonical_payload_json}\n${prev}`;
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

/** Ledger event row shape (current schema). */
type LedgerEvent = {
  event_type: string;
  payload_json: string;
  prev_hash: string | null;
  block_hash: string;
  created_at?: string;
  actor_id?: string | null;
};

/**
 * Verify full hash-chain integrity for ordered ledger events.
 * Uses normative formula when actor_id present; legacy formula when actor_id null.
 * Throws Error on first violation.
 */
export function verifyLedgerChain(events: LedgerEvent[]): boolean {
  let expectedPrev: string | null = null;

  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    const prevStr = expectedPrev ?? '';

    if ((e.prev_hash ?? '') !== prevStr) {
      throw new Error(
        `Chain break at index ${i}: expected prev_hash=${prevStr || 'null'}, got=${e.prev_hash ?? 'null'}`
      );
    }

    const recomputed =
      e.actor_id != null && e.actor_id !== ''
        ? computeEventHash({
            prev_hash: e.prev_hash,
            event_type: e.event_type,
            ts_utc: e.created_at ?? '',
            actor_id: e.actor_id,
            canonical_payload_json: e.payload_json,
          })
        : computeEventHashLegacy({
            prev_hash: e.prev_hash,
            event_type: e.event_type,
            canonical_payload_json: e.payload_json,
          });

    if (recomputed !== e.block_hash) {
      throw new Error(
        `Hash mismatch at index ${i}: expected=${e.block_hash}, recomputed=${recomputed}`
      );
    }

    expectedPrev = e.block_hash;
  }

  return true;
}

/**
 * Append a ledger event (for anomaly detection, etc).
 * Uses normative hash formula with actor_id.
 */
export async function appendLedgerEvent(input: {
  event_type: string;
  user_id?: string | null;
  payload: Record<string, unknown>;
}): Promise<void> {
  const db = await getDb();
  const eventType = input.event_type;
  const payloadJson = canonicalJSON(input.payload);
  const tsUtc = new Date().toISOString();
  const actorId = input.user_id ?? '';
  const last = (await dbGet(db, 'SELECT block_hash FROM ledger_events ORDER BY id DESC LIMIT 1')) as { block_hash: string } | undefined;
  const prevHash = last?.block_hash ?? null;
  const blockHash = computeEventHash({
    prev_hash: prevHash,
    event_type: eventType,
    ts_utc: tsUtc,
    actor_id: actorId,
    canonical_payload_json: payloadJson,
  });
  await dbRun(db, 'INSERT INTO ledger_events (event_type, payload_json, prev_hash, block_hash, created_at, actor_id) VALUES (?, ?, ?, ?, ?, ?)', eventType, payloadJson, prevHash, blockHash, tsUtc, actorId || null);
}
