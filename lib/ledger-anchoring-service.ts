/**
 * Ledger Anchoring Service (Variant B: Anchoring)
 * Append-only events with signing; Merkle anchors; Proof API.
 */
import { getDb } from './db';
import { computeEventHash, canonicalJSON, verifyLedgerChain } from './ledger-hash';
import { signExportHash, verifyExportHash } from './evidence-signing';
import { createHash } from 'crypto';
import { randomUUID } from 'crypto';

export const ANCHORING_EVENT_TYPES = [
  'DOC_ACCEPTED',
  'DOC_REJECTED',
  'PATCH_PROPOSED',
  'PATCH_APPLIED',
  'ATTESTATION_ISSUED',
  'AUDITOR_PACK_PUBLISHED',
  'SAFETY_INSPECTION_RECORDED',
  'WORK_ORDER_INTAKE',
  'WORK_ORDER_RELEASE',
  'INSTALLATION_RECORDED',
] as const;

export type AnchoringEventType = (typeof ANCHORING_EVENT_TYPES)[number];

export interface AppendAnchoredInput {
  event_type: string;
  payload: Record<string, unknown>;
  actor_id?: string;
  org_id?: string;
  artifact_sha256?: string;
  artifact_ref?: string;
}

export interface LedgerEventRow {
  id: number;
  event_type: string;
  payload_json: string;
  prev_hash: string | null;
  block_hash: string;
  created_at: string;
  actor_id: string | null;
  artifact_sha256: string | null;
  artifact_ref: string | null;
  payload_c14n_sha256: string | null;
  signature: string | null;
  key_id: string | null;
  anchor_id: string | null;
}

/**
 * Appends event to ledger with signature (anchoring-ready).
 */
export function appendAnchoredEvent(input: AppendAnchoredInput): LedgerEventRow {
  const db = getDb();
  const ts = new Date().toISOString();
  const actorId = input.actor_id ?? '';
  const payloadObj = { ...input.payload };
  const payloadC14n = canonicalJSON(payloadObj);
  const payloadC14nSha = createHash('sha256').update(payloadC14n, 'utf8').digest('hex');

  const last = db.prepare('SELECT block_hash FROM ledger_events ORDER BY id DESC LIMIT 1').get() as
    | { block_hash: string }
    | undefined;
  const prevHash = last?.block_hash ?? null;

  const eventHash = computeEventHash({
    prev_hash: prevHash,
    event_type: input.event_type,
    ts_utc: ts,
    actor_id: actorId,
    canonical_payload_json: payloadC14n,
  });

  const { signature, keyId } = signExportHash(eventHash);

  db.prepare(
    `INSERT INTO ledger_events (
      event_type, payload_json, prev_hash, block_hash, created_at, actor_id,
      artifact_sha256, artifact_ref, payload_c14n_sha256, signature, key_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.event_type,
    payloadC14n,
    prevHash,
    eventHash,
    ts,
    actorId || null,
    input.artifact_sha256 ?? null,
    input.artifact_ref ?? null,
    payloadC14nSha,
    signature,
    keyId
  );

  const row = db.prepare('SELECT * FROM ledger_events ORDER BY id DESC LIMIT 1').get() as LedgerEventRow;
  return row;
}

/**
 * Gets event by id with full proof data.
 */
export function getEventProof(id: number): {
  event: LedgerEventRow;
  signatureValid: boolean;
  chainValid: boolean;
  anchor: { id: string; merkle_root: string | null; tx_hash: string | null; status: string } | null;
} | null {
  const db = getDb();
  const event = db.prepare('SELECT * FROM ledger_events WHERE id = ?').get(id) as LedgerEventRow | undefined;
  if (!event) return null;

  const signatureValid = event.signature
    ? verifyExportHash(event.block_hash, event.signature, event.key_id ?? undefined)
    : false;

  const all = db.prepare('SELECT event_type, prev_hash, block_hash, created_at, actor_id, payload_json FROM ledger_events ORDER BY id').all() as Array<{
    event_type: string;
    prev_hash: string | null;
    block_hash: string;
    created_at: string;
    actor_id: string | null;
    payload_json: string;
  }>;
  let chainValid = true;
  try {
    verifyLedgerChain(all);
  } catch {
    chainValid = false;
  }

  let anchor: { id: string; merkle_root: string | null; tx_hash: string | null; status: string } | null = null;
  if (event.anchor_id) {
    const a = db.prepare('SELECT id, merkle_root, tx_hash, status FROM ledger_anchors WHERE id = ?').get(event.anchor_id) as
      | { id: string; merkle_root: string | null; tx_hash: string | null; status: string }
      | undefined;
    if (a) anchor = a;
  }

  return { event, signatureValid, chainValid, anchor };
}

/**
 * Finds events by artifact_sha256.
 */
export function getEventsByArtifact(sha256: string): LedgerEventRow[] {
  const db = getDb();
  return db.prepare('SELECT * FROM ledger_events WHERE artifact_sha256 = ? ORDER BY id').all(sha256) as LedgerEventRow[];
}

/**
 * Gets anchor by id.
 */
export function getAnchor(id: string): {
  id: string;
  period_start: string;
  period_end: string;
  merkle_root: string | null;
  network: string | null;
  chain_id: string | null;
  tx_hash: string | null;
  anchored_at: string | null;
  status: string;
  events_count: number;
} | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM ledger_anchors WHERE id = ?').get(id) as {
    id: string;
    period_start: string;
    period_end: string;
    merkle_root: string | null;
    network: string | null;
    chain_id: string | null;
    tx_hash: string | null;
    anchored_at: string | null;
    status: string;
    events_count: number;
  } | undefined;
  return row ?? null;
}

/**
 * Builds Merkle tree from event hashes and returns root.
 * Deterministic: leaves sorted lexicographically by hash (hex string).
 * hash(a,b) = sha256(min(a,b) || max(a,b)).
 */
export function buildMerkleRoot(hashes: string[]): string {
  if (hashes.length === 0) return createHash('sha256').update('').digest('hex');
  const sorted = [...hashes].sort((a, b) => a.localeCompare(b));
  let level: Buffer[] = sorted.map((h) => Buffer.from(h, 'hex'));
  while (level.length > 1) {
    const next: Buffer[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : left;
      const [lo, hi] = Buffer.compare(left, right) <= 0 ? [left, right] : [right, left];
      next.push(createHash('sha256').update(Buffer.concat([lo, hi])).digest() as Buffer);
    }
    level = next;
  }
  return level[0].toString('hex');
}

/**
 * Creates anchor record (Merkle root for period).
 * Idempotent: if anchor for this period already exists (pending|confirmed|empty), returns existing id.
 * 0 events → status=empty, merkle_root=null (no publish).
 */
export function createAnchor(periodStart: string, periodEnd: string): string {
  const db = getDb();
  const existing = db
    .prepare(
      `SELECT id FROM ledger_anchors WHERE period_start = ? AND period_end = ? AND status IN ('pending','confirmed','empty') LIMIT 1`
    )
    .get(periodStart, periodEnd) as { id: string } | undefined;
  if (existing) return existing.id;

  const events = db
    .prepare(
      `SELECT id, block_hash FROM ledger_events WHERE created_at >= ? AND created_at < ? AND block_hash IS NOT NULL ORDER BY id`
    )
    .all(periodStart, periodEnd) as Array<{ id: number; block_hash: string }>;

  const hashes = events.map((e) => e.block_hash);
  const id = `anchor-${randomUUID().slice(0, 8)}`;

  if (events.length === 0) {
    db.prepare(
      `INSERT INTO ledger_anchors (id, period_start, period_end, merkle_root, status, events_count) VALUES (?, ?, ?, NULL, 'empty', 0)`
    ).run(id, periodStart, periodEnd);
  } else {
    const merkleRoot = buildMerkleRoot(hashes);
    db.prepare(
      `INSERT INTO ledger_anchors (id, period_start, period_end, merkle_root, status, events_count) VALUES (?, ?, ?, ?, 'pending', ?)`
    ).run(id, periodStart, periodEnd, merkleRoot, events.length);
  }

  return id;
}
