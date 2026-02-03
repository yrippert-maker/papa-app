import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getDbReadOnly } from '@/lib/db';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { verifyLedgerChain } from '@/lib/ledger-hash';
import { checkRateLimit, getClientKey } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const key = getClientKey(req);
  const { allowed, retryAfterMs } = checkRateLimit(key, { windowMs: 60_000, max: 10 });
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: retryAfterMs ? { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } : undefined,
      }
    );
  }

  const session = await getServerSession(authOptions);
  const err = requirePermission(session, PERMISSIONS.LEDGER_READ, req);
  if (err) return err;

  const t0 = performance.now();
  try {
    const db = getDbReadOnly();
    const rows = db
      .prepare(
        'SELECT id, event_type, payload_json, prev_hash, block_hash, created_at, actor_id FROM ledger_events ORDER BY id'
      )
      .all() as Array<{ id?: number; event_type: string; payload_json: string; prev_hash: string | null; block_hash: string; created_at?: string; actor_id?: string | null }>;

    verifyLedgerChain(rows);
    const timingMs = Math.round(performance.now() - t0);
    const scope =
      rows.length > 0
        ? {
            event_count: rows.length,
            id_min: rows[0]?.id ?? null,
            id_max: rows[rows.length - 1]?.id ?? null,
          }
        : { event_count: 0, id_min: null as number | null, id_max: null as number | null };

    return NextResponse.json(
      { ok: true, message: 'Ledger integrity: OK', scope, timing_ms: { total: timingMs } },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e) {
    console.error('[ledger/verify]', e);
    const msg = e instanceof Error ? e.message : 'Ledger verification failed';
    const isIntegrity = /chain break|hash mismatch/i.test(msg);
    const timingMs = Math.round(performance.now() - t0);
    return NextResponse.json(
      { ok: false, error: msg, timing_ms: { total: timingMs } },
      { status: isIntegrity ? 409 : 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
