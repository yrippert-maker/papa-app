/**
 * POST /api/signature/idemia/consent
 * IDEMIA Step 2: Submit Consent (PORTRAIT) — согласие на обработку биометрии.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { submitConsent } from '@/lib/idemia-client';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const Body = z.object({ identityId: z.string().uuid() });

export async function POST(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.LEDGER_APPEND, request);
  if (err) return err;

  try {
    const body = Body.parse(await request.json());
    await submitConsent(body.identityId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues }, { status: 400 });
    }
    console.error('[idemia/consent]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'IDEMIA consent failed' },
      { status: 500 }
    );
  }
}
