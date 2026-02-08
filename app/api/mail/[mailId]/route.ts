/**
 * GET /api/mail/:mailId
 * Детали письма: event, triage, decision history.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { getMailDetail } from '@/lib/mail-inbox-service';
import { internalError } from '@/lib/api/error-response';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ mailId: string }> }
) {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.AI_INBOX_VIEW, req);
  if (err) return err;

  try {
    const { mailId } = await params;
    const detail = getMailDetail(mailId);
    if (!detail.event) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (e) {
    return internalError('[mail/:mailId]', e, req?.headers);
  }
}
