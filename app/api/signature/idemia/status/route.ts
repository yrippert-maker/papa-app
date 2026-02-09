/**
 * GET /api/signature/idemia/status?identityId=...
 * IDEMIA: Get Identity Status (Step 5/8) — LOA и статус документов/портрета.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { getIdentityStatus } from '@/lib/idemia-client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.LEDGER_APPEND, request);
  if (err) return err;

  const identityId = request.nextUrl.searchParams.get('identityId');
  if (!identityId) {
    return NextResponse.json({ error: 'identityId required' }, { status: 400 });
  }

  try {
    const status = await getIdentityStatus(identityId);
    return NextResponse.json(status);
  } catch (e) {
    console.error('[idemia/status]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'IDEMIA status failed' },
      { status: 500 }
    );
  }
}
