/**
 * GET /api/compliance/inbox/:id
 * Детали изменения + proposal (если есть).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { getInboxItem, getProposalByEventId } from '@/lib/compliance-inbox-service';
import { internalError } from '@/lib/api/error-response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.COMPLIANCE_VIEW, req);
  if (err) return err;

  try {
    const { id } = await params;
    const item = await getInboxItem(id);
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const proposal = await getProposalByEventId(id);
    return NextResponse.json({
      ...item,
      proposal: proposal
        ? {
            id: proposal.id,
            status: proposal.status,
            targets: JSON.parse(proposal.targets_json),
            created_at: proposal.created_at,
          }
        : null,
    });
  } catch (e) {
    return internalError('[compliance/inbox/:id]', e, req?.headers);
  }
}
