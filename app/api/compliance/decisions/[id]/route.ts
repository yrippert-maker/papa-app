/**
 * GET /api/compliance/decisions/:id
 * Get single verification decision record.
 * Permission: COMPLIANCE.VIEW
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { getDecision } from '@/lib/decision-history-service';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.COMPLIANCE_VIEW, request);
  if (err) return err;

  const { id } = await params;
  if (!id) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Missing decision id' } },
      { status: 400 }
    );
  }

  try {
    const decision = getDecision(id);
    if (!decision) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Decision not found' } },
        { status: 404 }
      );
    }
    return NextResponse.json(decision);
  } catch (e) {
    console.error('[compliance/decisions/:id] Error:', e);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to get decision' } },
      { status: 500 }
    );
  }
}
