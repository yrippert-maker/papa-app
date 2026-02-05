/**
 * GET /api/anchoring/health
 * Anchoring health for Dashboard — OK | DELAYED | FAILED.
 * See lib/anchoring-health-service.ts for logic.
 * Auth не требуется: health для мониторинга и pre-login dashboard.
 */
import { NextResponse } from 'next/server';
import { getAnchoringHealth } from '@/lib/anchoring-health-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const body = await getAnchoringHealth();
    return NextResponse.json(body);
  } catch (e) {
    console.warn('[anchoring/health]', e);
    return NextResponse.json({
      network: 'polygon',
      chainId: 137,
      status: 'UNAVAILABLE',
      lastConfirmedAt: null,
      daysSinceLastConfirmed: null,
      windowDays: 30,
      confirmedInWindow: 0,
      emptyInWindow: 0,
      failedInWindow: 0,
      pendingOlderThanHours: 0,
    });
  }
}
