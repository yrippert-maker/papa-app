/**
 * GET /api/mail/:mailId
 * Детали письма: event, triage, decision history.
 */
import { NextResponse } from 'next/server';
import { getMailDetail } from '@/lib/mail-inbox-service';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ mailId: string }> }
) {
  try {
    const { mailId } = await params;
    const detail = getMailDetail(mailId);
    if (!detail.event) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
