import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getDbReadOnly, dbAll } from '@/lib/db';
import { requirePermissionWithAlias, PERMISSIONS } from '@/lib/authz';
import { badRequest } from '@/lib/api/error-response';
import { parsePaginationParams } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

/**
 * GET /api/inspection/cards — список техкарт контроля.
 * Permission: INSPECTION.VIEW (или INSPECTION.MANAGE).
 * Query: kind=INPUT|OUTPUT, status=DRAFT|IN_PROGRESS|COMPLETED|CANCELLED, limit, offset.
 */
export async function GET(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermissionWithAlias(session, PERMISSIONS.INSPECTION_VIEW, request);
  if (err) return err;

  try {
    const url = new URL(request.url);
    const { searchParams } = url;
    const kind = searchParams.get('kind') as 'INPUT' | 'OUTPUT' | null;
    const status = searchParams.get('status') as 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | null;
    const { limit, offset } = parsePaginationParams(searchParams);

    const db = await getDbReadOnly();
    let query = `
      SELECT c.*, r.request_no, r.request_kind, r.title as request_title
      FROM inspection_card c
      LEFT JOIN tmc_request r ON r.tmc_request_id = c.tmc_request_id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];
    if (kind) {
      query += ' AND c.card_kind = ?';
      params.push(kind);
    }
    if (status) {
      query += ' AND c.status = ?';
      params.push(status);
    }
    query += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const cards = await dbAll(db, query, ...params);
    return NextResponse.json({
      cards,
      hasMore: (cards as unknown[]).length === limit,
    });
  } catch (e) {
    if (e instanceof Error && /^Invalid (limit|cursor|offset)$/.test(e.message)) {
      return badRequest(e.message, request.headers);
    }
    console.error('[inspection/cards]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 }
    );
  }
}
