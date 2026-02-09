/**
 * POST /api/signature/idemia/create
 * IDEMIA Step 1: Create Identity — инициация сессии верификации по лицу.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { createIdentity } from '@/lib/idemia-client';

export const dynamic = 'force-dynamic';

export async function POST(): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.LEDGER_APPEND, null as unknown as Request);
  if (err) return err;

  if (!process.env.IDEMIA_IDENTITY_PROOFING_URL || !process.env.IDEMIA_API_KEY) {
    return NextResponse.json(
      { error: 'IDEMIA not configured. Set IDEMIA_IDENTITY_PROOFING_URL and IDEMIA_API_KEY.' },
      { status: 503 }
    );
  }

  try {
    const identity = await createIdentity();
    return NextResponse.json({
      identityId: identity.id,
      status: identity.status,
      levelOfAssurance: identity.levelOfAssurance,
    });
  } catch (e) {
    console.error('[idemia/create]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'IDEMIA create failed' },
      { status: 500 }
    );
  }
}
