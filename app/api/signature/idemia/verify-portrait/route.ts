/**
 * POST /api/signature/idemia/verify-portrait
 * IDEMIA Step 6: Capture Selfie — верификация селфи против фото в документе.
 * Body: multipart/form-data с identityId и Portrait (image)
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { capturePortrait, getPortraitStatus, pollUntilDone } from '@/lib/idemia-client';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.LEDGER_APPEND, request);
  if (err) return err;

  try {
    const formData = await request.formData();
    const identityId = formData.get('identityId')?.toString();
    const portrait = formData.get('Portrait') ?? formData.get('portrait');
    if (!identityId || !portrait || !(portrait instanceof Blob)) {
      return NextResponse.json(
        { error: 'identityId and Portrait (image file) required' },
        { status: 400 }
      );
    }

    const result = await capturePortrait(identityId, portrait);
    if (result.status === 'VERIFIED') {
      return NextResponse.json({ verified: true, portraitId: result.id });
    }
    if (result.status === 'INVALID' || result.status === 'NOT_VERIFIED') {
      return NextResponse.json({ verified: false, status: result.status });
    }

    const finalStatus = await pollUntilDone(
      identityId,
      result.id,
      (id, pid) => getPortraitStatus(id, pid).then((r) => ({ status: r.status })),
      60000,
      2000
    );
    return NextResponse.json({
      verified: finalStatus === 'VERIFIED',
      status: finalStatus,
    });
  } catch (e) {
    console.error('[idemia/verify-portrait]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'IDEMIA verify failed' },
      { status: 500 }
    );
  }
}
