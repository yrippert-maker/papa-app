import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getDbReadOnly } from '@/lib/db';
import { requirePermissionWithAlias, PERMISSIONS } from '@/lib/authz';
import { badRequest, notFound, jsonError } from '@/lib/api/error-response';
import { VerifyErrorCodes } from '@/lib/verify-error-codes';
import { buildEvidenceExport } from '@/lib/inspection-evidence';

export const dynamic = 'force-dynamic';

/**
 * GET /api/inspection/cards/:id/evidence — evidence export for compliance.
 * Returns card snapshot + check_results + audit events + export_hash.
 * Permission: INSPECTION.VIEW.
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

  try {
    const db = getDbReadOnly();

    const card = db
      .prepare(
        `SELECT c.*, r.request_no, r.request_kind, r.title as request_title, r.status as request_status
         FROM inspection_card c
         LEFT JOIN tmc_request r ON r.tmc_request_id = c.tmc_request_id
         WHERE c.inspection_card_id = ?`
      )
      .get(cardId) as Record<string, unknown> | undefined;

    if (!card) {
      return notFound('Card not found', request.headers);
    }

    const checkResults = db
      .prepare(
        `SELECT r.* FROM inspection_check_result r
         WHERE r.inspection_card_id = ?
         ORDER BY r.created_at`
      )
      .all(cardId) as Array<Record<string, unknown>>;

    const auditRows = db
      .prepare(
        `SELECT id, event_type, payload_json, created_at, block_hash, prev_hash, actor_id
         FROM ledger_events
         WHERE event_type IN ('INSPECTION_CARD_TRANSITION', 'INSPECTION_CHECK_RECORDED')
           AND json_extract(payload_json, '$.inspection_card_id') = ?
         ORDER BY created_at ASC`
      )
      .all(cardId) as Array<{
      id: number;
      event_type: string;
      payload_json: string;
      created_at: string;
      block_hash: string;
      prev_hash: string | null;
      actor_id: string | null;
    }>;

    const export_ = buildEvidenceExport(card, checkResults, auditRows);

    return NextResponse.json(export_);
  } catch (e) {
    console.error('[inspection/cards/:id/evidence]', e);
    return jsonError(
      500,
      VerifyErrorCodes.INTERNAL_ERROR,
      e instanceof Error ? e.message : 'Failed',
      request.headers
    );
  }
}
