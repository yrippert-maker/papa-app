/**
 * Inspection audit trail — append INSPECTION_CARD_TRANSITION to ledger.
 * v0.1.10: Inspection MANAGE
 */
import { computeEventHash, canonicalJSON } from '@/lib/ledger-hash';
import type { DbAdapter } from '@/lib/adapters/types';

export type InspectionTransitionPayload = {
  inspection_card_id: string;
  card_no?: string;
  from_status: string;
  to_status: string;
  transitioned_by: string;
  transitioned_at: string;
};

/**
 * Appends INSPECTION_CARD_TRANSITION event to ledger.
 * Must be called within the same db transaction/retry as the card update.
 */
export async function appendInspectionTransitionEvent(
  db: DbAdapter,
  actorId: string,
  payload: InspectionTransitionPayload
): Promise<string> {
  const event_type = 'INSPECTION_CARD_TRANSITION';
  const tsUtc = payload.transitioned_at;
  const payloadRecord: Record<string, unknown> = {
    inspection_card_id: payload.inspection_card_id,
    from_status: payload.from_status,
    to_status: payload.to_status,
    transitioned_by: payload.transitioned_by,
    transitioned_at: payload.transitioned_at,
  };
  if (payload.card_no) payloadRecord.card_no = payload.card_no;

  const payloadJson = canonicalJSON(payloadRecord);

  const last = (await (await db.prepare('SELECT block_hash FROM ledger_events ORDER BY id DESC LIMIT 1')).get()) as { block_hash: string } | undefined;
  const prevHash = last?.block_hash ?? null;

  const blockHash = computeEventHash({
    prev_hash: prevHash,
    event_type,
    ts_utc: tsUtc,
    actor_id: actorId,
    canonical_payload_json: payloadJson,
  });

  await (await db.prepare('INSERT INTO ledger_events (event_type, payload_json, prev_hash, block_hash, created_at, actor_id) VALUES (?, ?, ?, ?, ?, ?)')).run(event_type, payloadJson, prevHash, blockHash, tsUtc, actorId || null);

  return blockHash;
}

export type InspectionCheckRecordedPayload = {
  inspection_card_id: string;
  card_no?: string;
  check_code: string;
  result: string;
  value?: string;
  unit?: string;
  comment: string | null;
  recorded_at: string;
  recorded_by: string;
};

/**
 * Appends INSPECTION_CHECK_RECORDED event to ledger.
 * Must be called within the same db transaction/retry as the check result write.
 * Only call when data actually changed (idempotency: no duplicate events).
 * Accepts DbAdapter | Promise<DbAdapter> for Railway/CI type resolution.
 */
export async function appendInspectionCheckRecordedEvent(
  dbOrPromise: DbAdapter | Promise<DbAdapter>,
  actorId: string,
  payload: InspectionCheckRecordedPayload
): Promise<string> {
  const db = await dbOrPromise;
  const event_type = 'INSPECTION_CHECK_RECORDED';
  const tsUtc = payload.recorded_at;
  const payloadRecord: Record<string, unknown> = {
    inspection_card_id: payload.inspection_card_id,
    check_code: payload.check_code,
    result: payload.result,
    comment: payload.comment,
    recorded_at: payload.recorded_at,
    recorded_by: payload.recorded_by,
  };
  if (payload.card_no) payloadRecord.card_no = payload.card_no;
  if (payload.value) payloadRecord.value = payload.value;
  if (payload.unit) payloadRecord.unit = payload.unit;

  const payloadJson = canonicalJSON(payloadRecord);

  const last = (await (await db.prepare('SELECT block_hash FROM ledger_events ORDER BY id DESC LIMIT 1')).get()) as { block_hash: string } | undefined;
  const prevHash = last?.block_hash ?? null;

  const blockHash = computeEventHash({
    prev_hash: prevHash,
    event_type,
    ts_utc: tsUtc,
    actor_id: actorId,
    canonical_payload_json: payloadJson,
  });

  await (await db.prepare('INSERT INTO ledger_events (event_type, payload_json, prev_hash, block_hash, created_at, actor_id) VALUES (?, ?, ?, ?, ?, ?)')).run(event_type, payloadJson, prevHash, blockHash, tsUtc, actorId || null);

  return blockHash;
}
