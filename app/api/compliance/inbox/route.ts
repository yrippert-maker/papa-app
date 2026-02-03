/**
 * GET /api/compliance/inbox
 * Список изменений (change events).
 */
import { NextResponse } from 'next/server';
import { listInbox } from '@/lib/compliance-inbox-service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') as 'NEW' | 'ACCEPTED' | 'PROPOSED' | 'APPLIED' | 'REJECTED' | undefined;
    const limit = parseInt(searchParams.get('limit') ?? '50', 10);
    const items = listInbox({ status, limit });
    return NextResponse.json({ items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
