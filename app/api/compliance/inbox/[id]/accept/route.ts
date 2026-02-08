/**
 * POST /api/compliance/inbox/:id/accept
 * Принять изменение → создать patch proposal.
 */
import { NextResponse } from 'next/server';
import { acceptChangeEvent, type PatchTarget } from '@/lib/compliance-inbox-service';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { internalError } from '@/lib/api/error-response';

export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { comment?: string; targets?: PatchTarget[] };
    const { proposal_id } = await acceptChangeEvent(id, {
      actor_user_id: session?.user?.email ?? undefined,
      actor_role: session?.user?.role ?? undefined,
      comment: body.comment,
      targets: body.targets,
    });
    return NextResponse.json({ ok: true, proposal_id });
  } catch (e) {
    return internalError('[compliance/inbox/:id/accept]', e, req?.headers);
  }
}
