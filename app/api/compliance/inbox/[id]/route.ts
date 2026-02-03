/**
 * GET /api/compliance/inbox/:id
 * Детали изменения + proposal (если есть).
 */
import { NextResponse } from 'next/server';
import { getInboxItem, getProposalByEventId } from '@/lib/compliance-inbox-service';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const item = getInboxItem(id);
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const proposal = getProposalByEventId(id);
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
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
