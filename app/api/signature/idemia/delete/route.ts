/**
 * DELETE /api/signature/idemia/delete?identityId=...
 * IDEMIA: Delete identity — удалить все данные, связанные с identity.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { deleteIdentity } from '@/lib/idemia-client';

export const dynamic = 'force-dynamic';

export async function DELETE(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.LEDGER_APPEND, request);
  if (err) return err;

  const identityId = new URL(request.url).searchParams.get('identityId');
  if (!identityId) {
    return NextResponse.json({ error: 'identityId required' }, { status: 400 });
  }

  try {
    await deleteIdentity(identityId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[idemia/delete]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'IDEMIA delete failed' },
      { status: 500 }
    );
  }
}
