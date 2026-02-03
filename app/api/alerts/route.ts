/**
 * GET /api/alerts
 * Список предупреждений для Dashboard.
 */
import { NextResponse } from 'next/server';
import { getAlerts } from '@/lib/alerts-service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') ?? '12', 10);
    const alerts = await getAlerts(limit);
    return NextResponse.json({ alerts });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
