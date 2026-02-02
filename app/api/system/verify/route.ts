/**
 * Verify aggregator: single request returns AuthZ + Ledger snapshot.
 * Reuses runAuthzVerification and ledger logic; one call instead of N.
 * Permission: WORKSPACE.READ (page); ledger included only if LEDGER.READ.
 * Observability: request_id, structured logs, metrics.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { runAuthzVerification } from '@/lib/authz-verify-runner';
import { getDbReadOnly } from '@/lib/db';
import { verifyLedgerChain } from '@/lib/ledger-hash';
import { checkRateLimit, getClientKey } from '@/lib/rate-limit';
import { VERIFY_SKIP_REASONS } from '@/lib/verify-constants';
import { logVerify } from '@/lib/verify-aggregator-logger';
import { recordVerifyRequest } from '@/lib/verify-aggregator-metrics';
import { VerifyErrorCodes, type VerifyErrorPayload } from '@/lib/verify-error-codes';

export const dynamic = 'force-dynamic';

function requestId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `req-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function errorResponse(
  rid: string,
  code: (typeof VerifyErrorCodes)[keyof typeof VerifyErrorCodes],
  message: string,
  status: number
): NextResponse<VerifyErrorPayload> {
  return NextResponse.json({ error: { code, message, request_id: rid } }, { status });
}

type LedgerResult =
  | { ok: true; message: string; scope: { event_count: number; id_min: number | null; id_max: number | null } }
  | { ok: false; error: string };

function runLedgerVerification(): LedgerResult {
  const db = getDbReadOnly();
  const rows = db
    .prepare(
      'SELECT id, event_type, payload_json, prev_hash, block_hash, created_at, actor_id FROM ledger_events ORDER BY id'
    )
    .all() as Array<{
    id?: number;
    event_type: string;
    payload_json: string;
    prev_hash: string | null;
    block_hash: string;
    created_at?: string;
    actor_id?: string | null;
  }>;

  verifyLedgerChain(rows);
  const scope =
    rows.length > 0
      ? {
          event_count: rows.length,
          id_min: rows[0]?.id ?? null,
          id_max: rows[rows.length - 1]?.id ?? null,
        }
      : { event_count: 0, id_min: null as number | null, id_max: null as number | null };
  return { ok: true, message: 'Ledger integrity: OK', scope };
}

export async function GET(req: NextRequest) {
  const rid = requestId();
  const key = getClientKey(req);
  const { allowed, retryAfterMs } = checkRateLimit(key, { windowMs: 60_000, max: 10 });
  if (!allowed) {
    logVerify({ request_id: rid, event: 'verify_end', http_status: 429, rate_limited: true, error: 'RATE_LIMITED' });
    recordVerifyRequest({ httpStatus: 429, timingMs: 0, ledgerIncluded: false, rateLimited: true });
    return NextResponse.json(
      { error: { code: VerifyErrorCodes.RATE_LIMITED, message: 'Too many requests', request_id: rid } },
      {
        status: 429,
        headers: retryAfterMs ? { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } : undefined,
      }
    );
  }

  const session = await getServerSession(authOptions);
  const actor = (session?.user as { email?: string } | undefined)?.email;
  logVerify({ request_id: rid, event: 'verify_start', actor });

  const err = requirePermission(session, PERMISSIONS.WORKSPACE_READ, req);
  if (err) {
    const status = err.status;
    const code = status === 401 ? VerifyErrorCodes.UNAUTHORIZED : VerifyErrorCodes.FORBIDDEN;
    const message = status === 401 ? 'Unauthorized' : 'Forbidden';
    logVerify({ request_id: rid, event: 'verify_end', actor, http_status: status, error: code });
    recordVerifyRequest({ httpStatus: status, timingMs: 0, ledgerIncluded: false });
    return errorResponse(rid, code, message, status);
  }

  const hasLedgerRead = (session?.user as { permissions?: string[] } | undefined)?.permissions?.includes(
    'LEDGER.READ'
  );

  const t0 = performance.now();
  const generatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  // AuthZ: sync, always run
  const tAuthz = performance.now();
  let authzResult;
  try {
    authzResult = runAuthzVerification();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'AuthZ verification failed';
    logVerify({ request_id: rid, event: 'verify_end', actor, http_status: 503, error: VerifyErrorCodes.UPSTREAM_AUTHZ_ERROR });
    recordVerifyRequest({ httpStatus: 503, timingMs: Math.round(performance.now() - t0), ledgerIncluded: false, sourceError: 'authz' });
    return errorResponse(rid, VerifyErrorCodes.UPSTREAM_AUTHZ_ERROR, msg, 503);
  }
  const tAuthzEnd = performance.now();

  // Ledger: only if permission; may throw
  let ledgerResult: LedgerResult | null = null;
  let tLedgerMs = 0;
  if (hasLedgerRead) {
    const tLedger = performance.now();
    try {
      ledgerResult = runLedgerVerification();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ledger verification failed';
      logVerify({ request_id: rid, event: 'verify_end', actor, http_status: 503, error: VerifyErrorCodes.UPSTREAM_LEDGER_ERROR });
      recordVerifyRequest({ httpStatus: 503, timingMs: Math.round(performance.now() - t0), ledgerIncluded: false, sourceError: 'ledger' });
      return errorResponse(rid, VerifyErrorCodes.UPSTREAM_LEDGER_ERROR, msg, 503);
    }
    tLedgerMs = Math.round(performance.now() - tLedger);
  }

  const totalMs = Math.round(performance.now() - t0);
  const authzMs = Math.round(tAuthzEnd - tAuthz);

  const overallOk = authzResult.authz_ok && (ledgerResult === null || ledgerResult.ok);

  const ledgerSkipped = ledgerResult === null;
  const skipReason = ledgerSkipped ? VERIFY_SKIP_REASONS.LEDGER_READ_NOT_GRANTED : undefined;

  logVerify({
    request_id: rid,
    event: 'verify_end',
    actor,
    http_status: 200,
    timing_ms: totalMs,
    ledger_included: !ledgerSkipped,
    skip_reason: skipReason,
  });

  recordVerifyRequest({
    httpStatus: 200,
    timingMs: totalMs,
    ledgerIncluded: !ledgerSkipped,
    ledgerSkippedReason: skipReason,
    sourceError: !authzResult.authz_ok ? 'authz' : ledgerResult && !ledgerResult.ok ? 'ledger' : undefined,
  });

  return NextResponse.json(
    {
      ok: overallOk,
      schema_version: 1,
      generated_at: generatedAt,
      request_id: rid,
      authz_verification: {
        authz_ok: authzResult.authz_ok,
        message: authzResult.message,
        scope: authzResult.scope,
      },
      ledger_verification:
        ledgerResult === null
          ? { skipped: true, reason: VERIFY_SKIP_REASONS.LEDGER_READ_NOT_GRANTED }
          : ledgerResult.ok
            ? { ok: true, message: ledgerResult.message, scope: ledgerResult.scope }
            : { ok: false, error: ledgerResult.error },
      timing_ms: { total: totalMs, authz: authzMs, ledger: tLedgerMs },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
