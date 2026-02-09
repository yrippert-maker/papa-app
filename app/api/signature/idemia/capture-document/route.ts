/**
 * POST /api/signature/idemia/capture-document
 * IDEMIA Step 3: Upload ID Document — загрузка документа для верификации.
 * Body: multipart/form-data с identityId, DocumentFront, DocumentBack (optional), documentType
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { captureIdDocument } from '@/lib/idemia-client';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.LEDGER_APPEND, request);
  if (err) return err;

  try {
    const formData = await request.formData();
    const identityId = formData.get('identityId')?.toString();
    const front = formData.get('DocumentFront') ?? formData.get('documentFront');
    const back = formData.get('DocumentBack') ?? formData.get('documentBack');
    const documentType = (formData.get('documentType')?.toString() ?? 'IDENTITY_CARD') as
      | 'PASSPORT'
      | 'IDENTITY_CARD'
      | 'DRIVING_LICENSE';

    if (!identityId || !front || !(front instanceof Blob)) {
      return NextResponse.json(
        { error: 'identityId and DocumentFront (image) required' },
        { status: 400 }
      );
    }

    const result = await captureIdDocument(
      identityId,
      front,
      back instanceof Blob ? back : undefined,
      documentType
    );
    return NextResponse.json({
      documentId: result.id,
      status: result.status,
      type: result.type,
    });
  } catch (e) {
    console.error('[idemia/capture-document]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'IDEMIA capture document failed' },
      { status: 500 }
    );
  }
}
