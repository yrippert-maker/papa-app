import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getDb, withRetry } from '@/lib/db';
import { computeEventHash, canonicalJSON } from '@/lib/ledger-hash';
import { validateLedgerAppend } from '@/lib/ledger-schema';
import { requirePermission, PERMISSIONS } from '@/lib/authz';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const err = requirePermission(session, PERMISSIONS.LEDGER_APPEND);
  if (err) return err;

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const validated = validateLedgerAppend(body);
    if (!validated.success) {
      console.warn('[ledger/append] Rejected:', validated.error.slice(0, 200));
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    const { event_type, payload_json } = validated;
    const actorId = (session?.user?.id as string) ?? '';
    const tsUtc = new Date().toISOString();
    const payloadJson = canonicalJSON(payload_json as Record<string, unknown>);
    const blockHash = await withRetry(() => {
      const db = getDb();
      const last = db.prepare('SELECT block_hash FROM ledger_events ORDER BY id DESC LIMIT 1').get() as { block_hash: string } | undefined;
      const prevHash = last?.block_hash ?? null;
      const bh = computeEventHash({
        prev_hash: prevHash,
        event_type,
        ts_utc: tsUtc,
        actor_id: actorId,
        canonical_payload_json: payloadJson,
      });
      db.prepare(
        'INSERT INTO ledger_events (event_type, payload_json, prev_hash, block_hash, created_at, actor_id) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(event_type, payloadJson, prevHash, bh, tsUtc, actorId || null);
      return bh;
    });
    return NextResponse.json({ ok: true, block_hash: blockHash });
  } catch (e) {
    console.error('[ledger/append]', e);
    return NextResponse.json({ error: 'Append failed' }, { status: 500 });
  }
}
