/**
 * POST /api/compliance/proposals/:id/apply
 * Применить patch proposal (единственная точка, где меняются DOCX).
 */
import { NextResponse } from 'next/server';
import { applyProposal } from '@/lib/compliance-inbox-service';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;
    const result = applyProposal(id, { applied_by: session?.user?.email ?? undefined });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
