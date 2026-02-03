import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { runAuthzVerification } from '@/lib/authz-verify-runner';
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
  const err = requirePermission(session, PERMISSIONS.WORKSPACE_READ, req);
  if (err) return err;

  const t0 = performance.now();
  try {
    const result = runAuthzVerification();
    const t1 = performance.now();
    const timingMs = Math.round(t1 - t0);
    return NextResponse.json(
      {
        ok: result.authz_ok,
        schema_version: 1,
        authz_verification: result,
        timing_ms: { total: timingMs, verify: timingMs },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e) {
    console.error('[authz/verify]', e);
    const timingMs = Math.round(performance.now() - t0);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'AuthZ verification failed', timing_ms: { total: timingMs } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
