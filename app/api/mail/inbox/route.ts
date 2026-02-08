/**
 * GET /api/mail/inbox
 * Очередь писем для Portal. Фильтры: source, category, risk, status.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { listMailInbox } from '@/lib/mail-inbox-service';
import type { TriageCategory, MailStatus } from '@/types/mail-mvp';
import { internalError } from '@/lib/api/error-response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.AI_INBOX_VIEW, req);
  if (err) return err;

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
    return internalError('[mail/inbox]', e, req?.headers);
  }
}
