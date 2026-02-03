import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getDbReadOnly } from '@/lib/db';
import { requirePermissionWithAlias, PERMISSIONS } from '@/lib/authz';
import { badRequest } from '@/lib/api/error-response';
import { parsePaginationParams } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const err = requirePermissionWithAlias(session, PERMISSIONS.TMC_REQUEST_VIEW, request);
  if (err) return err;

  try {
    const url = new URL(request.url);
    const { searchParams } = url;
    const status = searchParams.get('status') || '';
    const { limit, offset } = parsePaginationParams(searchParams);

    const db = getDbReadOnly();
    let query = `
      SELECT l.*, i.name as item_name, i.item_code, i.unit
      FROM tmc_stock_lot l
      JOIN tmc_item i ON i.tmc_item_id = l.tmc_item_id
    `;
    const params: (string | number)[] = [];
    if (status) {
      query += ' WHERE l.status = ?';
      params.push(status);
    }
    query += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const lots = db.prepare(query).all(...params);
    return NextResponse.json({ lots, hasMore: (lots as unknown[]).length === limit });
  } catch (e) {
    if (e instanceof Error && /^Invalid (limit|cursor|offset)$/.test(e.message)) {
      return badRequest(e.message, request.headers);
    }
    console.error('[tmc/lots]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 }
    );
  }
}
