/**
 * GET /api/compliance/inbox
 * Список изменений (change events).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { listInbox } from '@/lib/compliance-inbox-service';
import { internalError } from '@/lib/api/error-response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.COMPLIANCE_VIEW, req);
  if (err) return err;

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') as 'NEW' | 'ACCEPTED' | 'PROPOSED' | 'APPLIED' | 'REJECTED' | undefined;
    const limit = parseInt(searchParams.get('limit') ?? '50', 10);
    const items = await listInbox({ status, limit });
    return NextResponse.json({ items });
  } catch (e) {
    return internalError('[compliance/inbox]', e, req?.headers);
  }
}
