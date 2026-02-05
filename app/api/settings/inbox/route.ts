/**
 * GET /api/settings/inbox
 * Filters: status=NEW|ANALYZED|APPROVED|REJECTED, source=ARMAK (etc).
 * Maps compliance_change_event status: ANALYZED->ACCEPTED, APPROVED->PROPOSED.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { listInbox } from '@/lib/compliance-inbox-service';
import type { ChangeEventStatus } from '@/lib/compliance-inbox-service';

export const dynamic = 'force-dynamic';

const SPEC_TO_DB: Record<string, ChangeEventStatus> = {
  NEW: 'NEW',
  ANALYZED: 'ACCEPTED',
  APPROVED: 'PROPOSED',
  REJECTED: 'REJECTED',
};

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.SETTINGS_VIEW);
  if (err) return err;
  try {
    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get('status') as string | undefined;
    const source = searchParams.get('source');
    const limit = parseInt(searchParams.get('limit') ?? '50', 10);
    const dbStatus = statusParam ? SPEC_TO_DB[statusParam.toUpperCase()] ?? (statusParam as ChangeEventStatus) : undefined;
    const items = await listInbox({ status: dbStatus, limit });
    let list = items;
    if (source) {
      const s = source.trim();
      list = list.filter((e) => e.source === s);
    }
    return NextResponse.json(list);
  } catch (e) {
    console.error('[settings/inbox GET]', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to load' }, { status: 500 });
  }
}
