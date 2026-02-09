/**
 * GET /api/signature/idemia/healthcheck
 * IDEMIA GIPS healthcheck — проверка доступности сервиса.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { healthcheck } from '@/lib/idemia-client';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.LEDGER_APPEND, null as unknown as Request);
  if (err) return err;

  if (!process.env.IDEMIA_IDENTITY_PROOFING_URL || !process.env.IDEMIA_API_KEY) {
    return NextResponse.json(
      { ok: false, error: 'IDEMIA not configured' },
      { status: 503 }
    );
  }

  try {
    const result = await healthcheck();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error('[idemia/healthcheck]', e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'IDEMIA unreachable' },
      { status: 502 }
    );
  }
}
