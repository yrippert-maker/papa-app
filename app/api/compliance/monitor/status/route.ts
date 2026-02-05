/**
 * GET /api/compliance/monitor/status
 * Когда последний run, сколько новых items.
 */
import { NextResponse } from 'next/server';
import { getMonitorStatus } from '@/lib/compliance-inbox-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const status = await getMonitorStatus();
    return NextResponse.json(status);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
