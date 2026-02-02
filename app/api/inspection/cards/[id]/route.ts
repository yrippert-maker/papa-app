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

    const cardKind = (card.card_kind as string) ?? 'INPUT';
    const templates = db
      .prepare(
        `SELECT check_code, check_title, check_description, mandatory
         FROM inspection_check_item_template
         WHERE card_kind = ?
         ORDER BY item_order`
      )
      .all(cardKind) as Array<{ check_code: string; check_title: string; check_description: string | null; mandatory: number }>;

    const hints: Record<string, { title: string; description: string | null; mandatory: boolean }> = {};
    for (const t of templates) {
      hints[t.check_code] = {
        title: t.check_title,
        description: t.check_description,
        mandatory: !!t.mandatory,
      };
    }

    return NextResponse.json({
      ...card,
      check_results: results,
      template_hints: hints,
    });
  } catch (e) {
    console.error('[inspection/cards/:id]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 }
    );
  }
}
