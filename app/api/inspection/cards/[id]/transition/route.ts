import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getDb, withRetry, dbGet, dbRun } from '@/lib/db';
import { requirePermissionWithAlias, PERMISSIONS } from '@/lib/authz';
import { badRequest, rateLimitError } from '@/lib/api/error-response';
import { checkRateLimit, getClientKey } from '@/lib/rate-limit';
import { validateTransition, type InspectionCardStatus } from '@/lib/inspection/transitions';
import { appendInspectionTransitionEvent } from '@/lib/inspection-audit';

export const dynamic = 'force-dynamic';

const WRITE_RATE_LIMIT = { windowMs: 60_000, max: 60 };

/**
 * POST /api/inspection/cards/:id/transition — изменение статуса карты.
 * Permission: INSPECTION.MANAGE.
 * Body: { status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const key = `inspection-transition:${getClientKey(req)}`;
  const { allowed, retryAfterMs } = checkRateLimit(key, WRITE_RATE_LIMIT);
  if (!allowed) {
    return rateLimitError(
      'Too many requests',
      req.headers,
      retryAfterMs ? Math.ceil(retryAfterMs / 1000) : undefined
    );
  }

  const session = await getServerSession(authOptions);
  const err = await requirePermissionWithAlias(session, PERMISSIONS.INSPECTION_MANAGE, req);
  if (err) return err;

  const { id } = await params;
  if (!id?.trim()) {
    return badRequest('Missing card id', req.headers);
  }

  try {
    const body = await req.json();
    const targetStatus = body?.status as InspectionCardStatus | undefined;
    if (!targetStatus || !['IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(targetStatus)) {
      return badRequest('Invalid status', req.headers);
    }

    const actorId = (session?.user?.id as string) ?? '';
    const actorEmail = (session?.user?.email as string) ?? 'unknown';
    const transitionedAt = new Date().toISOString();

    const result = await withRetry(
      async () => {
      const db = await getDb();
      const card = (await dbGet(db, 'SELECT inspection_card_id, status, card_no FROM inspection_card WHERE inspection_card_id = ?', id.trim())) as { inspection_card_id: string; status: InspectionCardStatus; card_no: string } | undefined;

      if (!card) {
        return { notFound: true } as const;
      }

      // Validate transition
      try {
        validateTransition(card.status, targetStatus);
      } catch (e) {
        return { invalidTransition: true, error: e instanceof Error ? e.message : 'Invalid transition' } as const;
      }

      // Update card
      await dbRun(db, 'UPDATE inspection_card SET status = ?, transitioned_by = ?, transitioned_at = ?, updated_at = datetime(\'now\') WHERE inspection_card_id = ?', targetStatus, actorEmail, transitionedAt, card.inspection_card_id);

      // Audit trail (appendInspectionTransitionEvent is async)
      await appendInspectionTransitionEvent(db, actorId, {
        inspection_card_id: card.inspection_card_id,
        card_no: card.card_no,
        from_status: card.status,
        to_status: targetStatus,
        transitioned_by: actorEmail,
        transitioned_at: transitionedAt,
      });

      const updated = (await dbGet(db, 'SELECT * FROM inspection_card WHERE inspection_card_id = ?', card.inspection_card_id)) as Record<string, unknown>;

      return { ...updated, from_status: card.status };
    },
      { maxAttempts: 5 }
    );

    if ('notFound' in result && result.notFound) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }
    if ('invalidTransition' in result && result.invalidTransition) {
      return badRequest(result.error, req.headers);
    }

    return NextResponse.json(result);
  } catch (e) {
    console.error('[inspection/cards/:id/transition]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Transition failed' },
      { status: 500 }
    );
  }
}
