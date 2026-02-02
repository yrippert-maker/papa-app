import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getDbReadOnly } from '@/lib/db';
import { requirePermissionWithAlias, PERMISSIONS } from '@/lib/authz';
import { badRequest, notFound, jsonError } from '@/lib/api/error-response';
import { VerifyErrorCodes } from '@/lib/verify-error-codes';
import { buildEvidenceExport } from '@/lib/inspection-evidence';
import { signExportHash, ensureKeys } from '@/lib/evidence-signing';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * GET /api/inspection/cards/:id/evidence — evidence export for compliance.
 * Returns card snapshot + check_results + audit events + export_hash.
 * Query: signed=1 — add signature; format=bundle — return ZIP.
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
  const url = new URL(request.url);
  const signed = url.searchParams.get('signed') === '1';
  const format = url.searchParams.get('format');

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

    let export_ = buildEvidenceExport(card, checkResults, auditRows);

    if (signed || format === 'bundle') {
      const { publicKey } = ensureKeys();
      const signature = signExportHash(export_.export_hash);
      export_ = { ...export_, export_signature: signature, export_public_key: publicKey };
    }

    if (format === 'bundle') {
      const { default: JSZip } = await import('jszip');
      const jsonStr = JSON.stringify(export_, null, 2);
      const jsonSha = crypto.createHash('sha256').update(jsonStr, 'utf8').digest('hex');
      const sigStr = export_.export_signature ?? '';
      const sigSha = crypto.createHash('sha256').update(sigStr, 'utf8').digest('hex');
      const manifest = {
        schema_version: '1',
        exported_at: export_.exported_at,
        inspection_card_id: export_.inspection_card_id,
        export_hash: export_.export_hash,
        files: {
          'export.json': { sha256: jsonSha },
          'export.signature': { sha256: sigSha, content: 'hex signature of export_hash' },
        },
      };
      const manifestStr = JSON.stringify(manifest, null, 2);

      const zip = new JSZip();
      zip.file('export.json', jsonStr);
      zip.file('export.signature', sigStr);
      zip.file('manifest.json', manifestStr);
      if (export_.export_public_key) {
        zip.file('public.pem', export_.export_public_key);
      }
      const zipBuf = await zip.generateAsync({ type: 'arraybuffer' });

      return new NextResponse(zipBuf, {
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="evidence-${cardId}-${export_.exported_at.slice(0, 10)}.zip"`,
        },
      });
    }

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
