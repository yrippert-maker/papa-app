/**
 * POST /api/mail/:mailId/decision
 * Решение оператора: accept | reject | escalate | request_info.
 * При accept в теле можно передать apply_mode: draft | safe_auto | manual.
 */
import { NextResponse } from 'next/server';
import { recordOperatorDecision } from '@/lib/mail-inbox-service';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import type { OperatorDecisionType, ApplyMode } from '@/types/mail-mvp';

export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ mailId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const operatorId = session?.user?.email ?? session?.user?.name ?? 'anonymous';
    const { mailId } = await params;
    const body = (await req.json().catch(() => ({}))) as {
      decision: OperatorDecisionType;
      reason?: string | null;
      apply_mode?: ApplyMode;
    };
    const { decision, reason, apply_mode } = body;
    if (!decision || !['accept', 'reject', 'escalate', 'request_info'].includes(decision)) {
      return NextResponse.json(
        { error: 'Invalid decision; use accept|reject|escalate|request_info' },
        { status: 400 }
      );
    }
    recordOperatorDecision(mailId, {
      operator_id: operatorId,
      decision,
      reason: reason ?? null,
      apply_mode: decision === 'accept' ? apply_mode : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
