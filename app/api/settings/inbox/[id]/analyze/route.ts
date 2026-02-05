/**
 * POST /api/settings/inbox/{id}/analyze
 * Operator/Admin. Forms Review Packet (summary, affected docs, proposal, EvidenceMap).
 * Delegates to compliance accept (accept → creates proposal).
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { acceptChangeEvent, getInboxItem } from '@/lib/compliance-inbox-service';

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
    if (event.status !== 'NEW') return NextResponse.json({ error: 'Event already analyzed or processed' }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    const { comment, targets } = body;
    const result = await acceptChangeEvent(id, {
      actor_user_id: session?.user?.id as string | undefined,
      actor_role: (session?.user as { role?: string })?.role,
      comment: comment ?? undefined,
      targets: targets ?? [],
    });
    return NextResponse.json({ ok: true, proposalId: result.proposal_id });
  } catch (e) {
    console.error('[settings/inbox analyze]', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Analyze failed' }, { status: 500 });
  }
}
