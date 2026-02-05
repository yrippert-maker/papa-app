/**
 * POST /api/settings/inbox/{id}/reject
 * Reviewer/Operator/Admin. Reject change event.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { rejectChangeEvent, getInboxItem } from '@/lib/compliance-inbox-service';

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
    if (event.status !== 'NEW') return NextResponse.json({ error: 'Event already processed' }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    await rejectChangeEvent(id, {
      actor_user_id: session?.user?.id as string | undefined,
      actor_role: (session?.user as { role?: string })?.role,
      comment: body.comment ?? undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[settings/inbox reject]', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Reject failed' }, { status: 500 });
  }
}
