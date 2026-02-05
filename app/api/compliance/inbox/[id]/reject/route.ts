/**
 * POST /api/compliance/inbox/:id/reject
 * Отклонить изменение.
 */
import { NextResponse } from 'next/server';
import { rejectChangeEvent } from '@/lib/compliance-inbox-service';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { comment?: string };
    await rejectChangeEvent(id, {
      actor_user_id: session?.user?.email ?? undefined,
      actor_role: session?.user?.role ?? undefined,
      comment: body.comment,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
