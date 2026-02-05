/**
 * GET /api/compliance/decisions
 * List verification decision records (from audit packs).
 * Permission: COMPLIANCE.VIEW
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { listDecisions } from '@/lib/decision-history-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.COMPLIANCE_VIEW, request);
  if (err) return err;

  try {
    const decisions = listDecisions();
    return NextResponse.json({ decisions });
  } catch (e) {
    console.error('[compliance/decisions] Error:', e);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to list decisions' } },
      { status: 500 }
    );
  }
}
