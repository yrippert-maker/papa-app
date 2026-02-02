import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getDbReadOnly } from '@/lib/db';
import { requirePermissionWithAlias, PERMISSIONS } from '@/lib/authz';
import { badRequest } from '@/lib/api/error-response';

export const dynamic = 'force-dynamic';

/**
 * GET /api/inspection/cards/:id — деталь техкарты контроля.
 * Permission: INSPECTION.VIEW (или INSPECTION.MANAGE).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const err = requirePermissionWithAlias(session, PERMISSIONS.INSPECTION_VIEW, request);
  if (err) return err;

  const { id } = await params;
  if (!id?.trim()) {
    return badRequest('Missing card id', request.headers);
  }

  try {
    const db = getDbReadOnly();
    const card = db
      .prepare(
        `SELECT c.*, r.request_no, r.request_kind, r.title as request_title, r.status as request_status
         FROM inspection_card c
         LEFT JOIN tmc_request r ON r.tmc_request_id = c.tmc_request_id
         WHERE c.inspection_card_id = ?`
      )
      .get(id.trim()) as Record<string, unknown> | undefined;

    if (!card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    const results = db
      .prepare(
        `SELECT r.* FROM inspection_check_result r
         WHERE r.inspection_card_id = ?
         ORDER BY r.created_at`
      )
      .all(id.trim()) as Array<Record<string, unknown>>;

    return NextResponse.json({
      ...card,
      check_results: results,
    });
  } catch (e) {
    console.error('[inspection/cards/:id]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 }
    );
  }
}
