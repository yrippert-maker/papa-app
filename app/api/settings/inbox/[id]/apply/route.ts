/**
 * POST /api/settings/inbox/{id}/apply
 * Operator/Admin. Apply proposal for change event (id = change_event_id).
 * Requires event status PROPOSED; applies the proposal and sets APPLIED.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { getInboxItem, getProposalByEventId, applyProposal } from '@/lib/compliance-inbox-service';
import { appendLedgerEvent } from '@/lib/ledger-hash';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.SETTINGS_VIEW);
  if (err) return err;
  const id = (await params).id;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  try {
    const event = await getInboxItem(id);
    if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (event.status !== 'PROPOSED') return NextResponse.json({ error: 'Event must be in PROPOSED state (approved) before apply' }, { status: 400 });
    const proposal = await getProposalByEventId(id);
    if (!proposal) return NextResponse.json({ error: 'No proposal found for this event' }, { status: 400 });
    const result = await applyProposal(proposal.id, { applied_by: session?.user?.id as string | undefined });

    const actorId = session?.user?.id ?? session?.user?.email ?? 'anonymous';
    await appendLedgerEvent({
      event_type: 'INBOX_PATCH_APPLIED',
      user_id: actorId,
      payload: {
        actor: actorId,
        actor_email: session?.user?.email ?? null,
        timestamp: new Date().toISOString(),
        change_event_id: id,
        proposal_id: proposal.id,
        output_relative_path: event.fulltext_path ?? null,
        sha256: event.artifact_sha256 ?? null,
        artifact_sha256: event.artifact_sha256 ?? null,
        approval_record_id: proposal.id,
      },
    });

    return NextResponse.json({ ok: true, applied: result.applied, message: result.message });
  } catch (e) {
    console.error('[settings/inbox apply]', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Apply failed' }, { status: 500 });
  }
}
