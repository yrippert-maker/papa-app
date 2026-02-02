/**
 * Inspection audit trail — append INSPECTION_CARD_TRANSITION to ledger.
 * v0.1.10: Inspection MANAGE
 */
import { computeEventHash, canonicalJSON } from '@/lib/ledger-hash';
import type { getDb } from '@/lib/db';

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
export function appendInspectionTransitionEvent(
  db: ReturnType<typeof getDb>,
  actorId: string,
  payload: InspectionTransitionPayload
): string {
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

  const last = db.prepare('SELECT block_hash FROM ledger_events ORDER BY id DESC LIMIT 1').get() as
    | { block_hash: string }
    | undefined;
  const prevHash = last?.block_hash ?? null;

  const blockHash = computeEventHash({
    prev_hash: prevHash,
    event_type,
    ts_utc: tsUtc,
    actor_id: actorId,
    canonical_payload_json: payloadJson,
  });

  db.prepare(
    'INSERT INTO ledger_events (event_type, payload_json, prev_hash, block_hash, created_at, actor_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(event_type, payloadJson, prevHash, blockHash, tsUtc, actorId || null);

  return blockHash;
}
