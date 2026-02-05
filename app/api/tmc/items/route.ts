import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getDbReadOnly, dbAll } from '@/lib/db';
import { requirePermissionWithAlias, PERMISSIONS } from '@/lib/authz';
import { badRequest } from '@/lib/api/error-response';
import { parsePaginationParams } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermissionWithAlias(session, PERMISSIONS.TMC_REQUEST_VIEW, req);
  if (err) return err;

  try {
    const url = new URL(req.url);
    const { limit, offset } = parsePaginationParams(url.searchParams);

    const db = await getDbReadOnly();
    const items = await dbAll(db, `
      SELECT 
        i.tmc_item_id, i.item_code, i.name, i.unit, i.category, i.manufacturer, i.part_no,
        COALESCE(SUM(l.qty_on_hand), 0) as total_on_hand,
        COUNT(DISTINCT l.tmc_lot_id) as lot_count
      FROM tmc_item i
      LEFT JOIN tmc_stock_lot l ON l.tmc_item_id = i.tmc_item_id AND l.status = 'ON_HAND'
      GROUP BY i.tmc_item_id
      ORDER BY i.name
      LIMIT ? OFFSET ?`,
    limit, offset);
    return NextResponse.json({ items, hasMore: items.length === limit });
  } catch (e) {
    if (e instanceof Error && /^Invalid (limit|cursor|offset)$/.test(e.message)) {
      return badRequest(e.message, req.headers);
    }
    console.error('[tmc/items]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 }
    );
  }
}
