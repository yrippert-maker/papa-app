/**
 * POST /api/compliance/monitor/run
 * Запускает сбор/дифф compliance monitor.
 */
import { NextResponse } from 'next/server';
import { createTestChangeEvent } from '@/lib/compliance-inbox-service';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const event = await createTestChangeEvent();
    return NextResponse.json({
      ok: true,
      created: event.id,
      message: 'Monitor run complete (test event). Real source parsing — next iteration.',
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
