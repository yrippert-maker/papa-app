import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getDb, withRetry } from '@/lib/db';
import { computeEventHash, canonicalJSON } from '@/lib/ledger-hash';
import { validateLedgerAppend } from '@/lib/ledger-schema';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { badRequest, rateLimitError } from '@/lib/api/error-response';
import { checkRateLimit, getClientKey } from '@/lib/rate-limit';
import { appendToDeadLetter } from '@/lib/ledger-dead-letter';

export const dynamic = 'force-dynamic';

const WRITE_RATE_LIMIT = { windowMs: 60_000, max: 60 };
const LEDGER_RETRY_ATTEMPTS = 5;

export async function POST(req: Request) {
  const key = `ledger-append:${getClientKey(req)}`;
  const { allowed, retryAfterMs } = checkRateLimit(key, WRITE_RATE_LIMIT);
  if (!allowed) {
    return rateLimitError(
      'Too many requests',
      req.headers,
      retryAfterMs ? Math.ceil(retryAfterMs / 1000) : undefined
    );
  }

  const session = await getServerSession(authOptions);
  const err = requirePermission(session, PERMISSIONS.LEDGER_APPEND, req);
  if (err) return err;

  let validated: { event_type: string; payload_json: unknown } | undefined;
  let actorId = '';
  let tsUtc = '';

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return badRequest('Invalid JSON', req.headers);
    }
    const v = validateLedgerAppend(body);
    if (!v.success) {
      console.warn('[ledger/append] Rejected:', v.error.slice(0, 200));
      return badRequest(v.error, req.headers);
    }
    validated = v as { event_type: string; payload_json: unknown };
    actorId = (session?.user?.id as string) ?? '';
    tsUtc = new Date().toISOString();
    const { event_type, payload_json } = validated;
    const payloadJson = canonicalJSON(payload_json as Record<string, unknown>);
    const blockHash = await withRetry(
      () => {
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
    },
      { maxAttempts: LEDGER_RETRY_ATTEMPTS }
    );
    return NextResponse.json({ ok: true, block_hash: blockHash });
  } catch (e) {
    console.error('[ledger/append]', e);
    if (validated) {
      try {
        const { event_type: et, payload_json: pj } = validated;
        appendToDeadLetter({
          event_type: et,
          payload_json: typeof pj === 'string' ? pj : JSON.stringify(pj ?? {}),
          actor_id: actorId || null,
          error: e instanceof Error ? e.message : 'Append failed',
          ts_utc: tsUtc,
        });
      } catch {
        // ignore dead-letter write failure
      }
    }
    return NextResponse.json({ error: 'Append failed' }, { status: 500 });
  }
}
