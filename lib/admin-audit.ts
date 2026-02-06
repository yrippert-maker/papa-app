/**
 * Admin audit — запись событий USER_* в ledger (US-5).
 * Вызывается только из защищённых API-роутов.
 */
import { getDb, dbGet, dbRun } from './db';
import { computeEventHash, canonicalJSON } from './ledger-hash';

export type AdminAuditEvent =
  | { type: 'USER_CREATED'; payload: { actor_id: string; actor_email: string; target_email: string; role_code: string } }
  | { type: 'USER_ROLE_CHANGED'; payload: { actor_id: string; actor_email: string; target_id: string; target_email: string; old_role: string; new_role: string } }
  | { type: 'USER_PASSWORD_RESET'; payload: { actor_id: string; actor_email: string; target_id: string; target_email: string } }
  | { type: 'USER_CREATE_DENIED'; payload: { actor_id: string; actor_email: string; target_email: string; reason: 'duplicate_email' } }
  | { type: 'USER_ROLE_CHANGE_DENIED'; payload: { actor_id: string; actor_email: string; target_id: string; target_email: string; reason: 'self_demote' } };

export async function appendAdminAudit(ev: AdminAuditEvent, actorId: string): Promise<void> {
  const db = await getDb();
  const eventType = ev.type;
  const payloadJson = canonicalJSON(ev.payload as Record<string, unknown>);
  const tsUtc = new Date().toISOString();
  const last = (await dbGet(db, 'SELECT block_hash FROM ledger_events ORDER BY id DESC LIMIT 1')) as { block_hash: string } | undefined;
  const prevHash = last?.block_hash ?? null;
  const blockHash = computeEventHash({
    prev_hash: prevHash,
    event_type: eventType,
    ts_utc: tsUtc,
    actor_id: actorId,
    canonical_payload_json: payloadJson,
  });
  await dbRun(db, 'INSERT INTO ledger_events (event_type, payload_json, prev_hash, block_hash, created_at, actor_id) VALUES (?, ?, ?, ?, ?, ?)', eventType, payloadJson, prevHash, blockHash, tsUtc, actorId);
}
