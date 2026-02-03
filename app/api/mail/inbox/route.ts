/**
 * GET /api/mail/inbox
 * Очередь писем для Portal. Фильтры: source, category, risk, status.
 */
import { NextResponse } from 'next/server';
import { listMailInbox } from '@/lib/mail-inbox-service';
import type { TriageCategory, MailStatus } from '@/types/mail-mvp';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const source = searchParams.get('source') as 'gmail' | 'imap' | undefined;
    const category = searchParams.get('category') as TriageCategory | undefined;
    const risk = searchParams.get('risk') ?? undefined;
    const status = searchParams.get('status') as MailStatus | undefined;
    const limit = parseInt(searchParams.get('limit') ?? '50', 10);

    const items = listMailInbox({
      source,
      category,
      risk: risk || undefined,
      status,
      limit,
    });
    return NextResponse.json({ items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
