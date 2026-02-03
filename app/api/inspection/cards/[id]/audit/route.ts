import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getDbReadOnly } from '@/lib/db';
import { requirePermissionWithAlias, PERMISSIONS } from '@/lib/authz';
import { badRequest } from '@/lib/api/error-response';

export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

/**
 * GET /api/inspection/cards/:id/audit — события журнала по техкарте.
 * Возвращает INSPECTION_CARD_TRANSITION и INSPECTION_CHECK_RECORDED.
 * Permission: INSPECTION.VIEW.
 * Query: limit (default 100, max 500), offset (default 0).
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

  const cardId = id.trim();

  const url = new URL(request.url);
  let limit = parseInt(url.searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10);
  let offset = parseInt(url.searchParams.get('offset') ?? '0', 10);
  if (Number.isNaN(limit) || limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  if (Number.isNaN(offset) || offset < 0) offset = 0;

  try {
    const db = getDbReadOnly();

    const card = db.prepare('SELECT inspection_card_id FROM inspection_card WHERE inspection_card_id = ?').get(cardId);
    if (!card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    const total = db
      .prepare(
        `SELECT COUNT(*) as c FROM ledger_events
         WHERE event_type IN ('INSPECTION_CARD_TRANSITION', 'INSPECTION_CHECK_RECORDED')
           AND json_extract(payload_json, '$.inspection_card_id') = ?`
      )
      .get(cardId) as { c: number };
    const totalCount = total?.c ?? 0;

    const rows = db
      .prepare(
        `SELECT id, event_type, payload_json, created_at, block_hash, actor_id
         FROM ledger_events
         WHERE event_type IN ('INSPECTION_CARD_TRANSITION', 'INSPECTION_CHECK_RECORDED')
           AND json_extract(payload_json, '$.inspection_card_id') = ?
         ORDER BY created_at ASC
         LIMIT ? OFFSET ?`
      )
      .all(cardId, limit, offset) as Array<{
      id: number;
      event_type: string;
      payload_json: string;
      created_at: string;
      block_hash: string;
      actor_id: string | null;
    }>;

    const events = rows.map((r) => {
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(r.payload_json) as Record<string, unknown>;
      } catch {
        payload = {};
      }
      return {
        id: r.id,
        event_type: r.event_type,
        payload,
        created_at: r.created_at,
        block_hash: r.block_hash,
        actor_id: r.actor_id,
      };
    });

    const hasMore = offset + events.length < totalCount;

    return NextResponse.json({
      events,
      total: totalCount,
      hasMore,
      limit,
      offset,
    });
  } catch (e) {
    console.error('[inspection/cards/:id/audit]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 }
    );
  }
}
