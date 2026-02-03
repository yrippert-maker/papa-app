/**
 * GET /api/anchoring/health
 * Anchoring health for Dashboard — OK | DELAYED | FAILED.
 * See lib/anchoring-health-service.ts for logic.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { getAnchoringHealth } from '@/lib/anchoring-health-service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const err = requirePermission(session, PERMISSIONS.WORKSPACE_READ, req);
  if (err) return err;

  try {
    const body = getAnchoringHealth();
    return NextResponse.json(body);
  } catch (e) {
    console.error('[anchoring/health]', e);
    return NextResponse.json(
      {
        network: 'polygon',
        chainId: 137,
        status: 'FAILED',
        lastConfirmedAt: null,
        daysSinceLastConfirmed: null,
        windowDays: 30,
        confirmedInWindow: 0,
        emptyInWindow: 0,
        failedInWindow: 0,
        pendingOlderThanHours: 0,
      },
      { status: 500 }
    );
  }
}
