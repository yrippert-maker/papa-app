import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getDbReadOnly, dbAll } from '@/lib/db';
import { requirePermissionWithAlias, PERMISSIONS } from '@/lib/authz';
import { badRequest } from '@/lib/api/error-response';
import { parsePaginationParams } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermissionWithAlias(session, PERMISSIONS.TMC_REQUEST_VIEW, request);
  if (err) return err;

  try {
    const url = new URL(request.url);
    const { searchParams } = url;
    const kind = searchParams.get('kind') as 'INCOMING' | 'OUTGOING' | null;
    const { limit, offset } = parsePaginationParams(searchParams);

    const db = await getDbReadOnly();
    let query = `
      SELECT r.*, 
        (SELECT COUNT(*) FROM tmc_request_line rl WHERE rl.tmc_request_id = r.tmc_request_id) as line_count
      FROM tmc_request r
      WHERE 1=1
    `;
    const params: (string | number)[] = [];
    if (kind) {
      query += ' AND r.request_kind = ?';
      params.push(kind);
    }
    query += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const requests = await dbAll(db, query, ...params);
    return NextResponse.json({ requests, hasMore: (requests as unknown[]).length === limit });
  } catch (e) {
    if (e instanceof Error && /^Invalid (limit|cursor|offset)$/.test(e.message)) {
      return badRequest(e.message, request.headers);
    }
    console.error('[tmc/requests]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 }
    );
  }
}
