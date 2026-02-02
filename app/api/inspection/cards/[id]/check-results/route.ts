import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getDb, withRetry } from '@/lib/db';
import { requirePermissionWithAlias, PERMISSIONS } from '@/lib/authz';
import { badRequest } from '@/lib/api/error-response';
import { canWriteCheckResults, type InspectionCardStatus } from '@/lib/inspection/transitions';
import { appendInspectionCheckRecordedEvent } from '@/lib/inspection-audit';

export const dynamic = 'force-dynamic';

const VALID_RESULTS = ['PASS', 'FAIL', 'NA'] as const;

type CheckResultInput = {
  check_code: string;
  result: (typeof VALID_RESULTS)[number];
  value?: string;
  unit?: string;
  comment?: string;
};

function validateResults(body: unknown): CheckResultInput[] {
  const obj = body as { results?: unknown };
  if (!obj || !Array.isArray(obj.results) || obj.results.length === 0) {
    throw new Error('results array required and must not be empty');
  }
  const out: CheckResultInput[] = [];
  for (let i = 0; i < obj.results.length; i++) {
    const r = obj.results[i] as Record<string, unknown>;
    const code = typeof r?.check_code === 'string' ? r.check_code.trim() : '';
    const result = typeof r?.result === 'string' ? (r.result.toUpperCase() as string) : '';
    if (!code) throw new Error(`results[${i}]: check_code required`);
    if (!VALID_RESULTS.includes(result as (typeof VALID_RESULTS)[number])) {
      throw new Error(`results[${i}]: result must be PASS, FAIL, or NA`);
    }
    const value = r?.value != null ? String(r.value) : '';
    const unit = r?.unit != null ? String(r.unit) : '';
    const comment = typeof r?.comment === 'string' ? r.comment : '';
    out.push({ check_code: code, result: result as (typeof VALID_RESULTS)[number], value, unit, comment });
  }
  return out;
}

/**
 * POST /api/inspection/cards/:id/check-results — запись результатов проверок.
 * Permission: INSPECTION.MANAGE.
 * Body: { results: [ { check_code, result, value?, unit?, comment? } ] }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const err = requirePermissionWithAlias(session, PERMISSIONS.INSPECTION_MANAGE, req);
  if (err) return err;

  const { id } = await params;
  if (!id?.trim()) {
    return badRequest('Missing card id', req.headers);
  }

  try {
    const body = await req.json();
    let results: CheckResultInput[];
    try {
      results = validateResults(body);
    } catch (e) {
      return badRequest(e instanceof Error ? e.message : 'Invalid payload', req.headers);
    }

    const actorId = (session?.user?.id as string) ?? '';
    const actorEmail = (session?.user?.email as string) ?? 'unknown';

    const output = await withRetry(() => {
      const db = getDb();
      const card = db
        .prepare(
          'SELECT inspection_card_id, status, card_kind, card_no FROM inspection_card WHERE inspection_card_id = ?'
        )
        .get(id.trim()) as
        | { inspection_card_id: string; status: InspectionCardStatus; card_kind: string; card_no: string }
        | undefined;

      if (!card) {
        return { notFound: true } as const;
      }

      if (!canWriteCheckResults(card.status)) {
        return { immutable: true, status: card.status } as const;
      }

      // Valid check_codes for this card_kind from templates
      const templates = db
        .prepare(
          'SELECT check_code FROM inspection_check_item_template WHERE card_kind = ?'
        )
        .all(card.card_kind) as Array<{ check_code: string }>;
      const validCodes = new Set(templates.map((t) => t.check_code));

      const changed: Array<{ check_code: string; result: string; value: string; unit: string; comment: string | null }> = [];
      for (const r of results) {
        if (!validCodes.has(r.check_code)) {
          return { invalidCheckCode: true, check_code: r.check_code } as const;
        }
        const existing = db
          .prepare(
            'SELECT inspection_check_result_id, result, value, unit, comment FROM inspection_check_result WHERE inspection_card_id = ? AND check_code = ?'
          )
          .get(card.inspection_card_id, r.check_code) as
          | { inspection_check_result_id: string; result: string; value: string | null; unit: string | null; comment: string | null }
          | undefined;

        const resultId =
          existing?.inspection_check_result_id ??
          `CHR-${card.inspection_card_id}-${r.check_code}-${Date.now()}`;

        const val = r.value ?? '';
        const u = r.unit ?? '';
        const comm = r.comment ?? null;

        if (existing) {
          const same =
            existing.result === r.result &&
            (existing.value ?? '') === val &&
            (existing.unit ?? '') === u &&
            (existing.comment ?? '') === (comm ?? '');
          if (same) continue;
          db.prepare(
            'UPDATE inspection_check_result SET result = ?, value = ?, unit = ?, comment = ? WHERE inspection_check_result_id = ?'
          ).run(r.result, val || null, u || null, comm, resultId);
        } else {
          const checkItem = db
            .prepare(
              'SELECT check_item_id FROM inspection_check_item_template WHERE card_kind = ? AND check_code = ? LIMIT 1'
            )
            .get(card.card_kind, r.check_code) as { check_item_id: string } | undefined;
          db.prepare(
            `INSERT INTO inspection_check_result (inspection_check_result_id, inspection_card_id, check_item_id, check_code, result, value, unit, comment, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
          ).run(resultId, card.inspection_card_id, checkItem?.check_item_id ?? null, r.check_code, r.result, val || null, u || null, comm);
        }
        changed.push({ check_code: r.check_code, result: r.result, value: val, unit: u, comment: comm });
      }

      const recordedAt = new Date().toISOString();
      for (const c of changed) {
        appendInspectionCheckRecordedEvent(db, actorId, {
          inspection_card_id: card.inspection_card_id,
          card_no: card.card_no,
          check_code: c.check_code,
          result: c.result,
          value: c.value || undefined,
          unit: c.unit || undefined,
          comment: c.comment,
          recorded_at: recordedAt,
          recorded_by: actorEmail,
        });
      }

      const allResults = db
        .prepare('SELECT * FROM inspection_check_result WHERE inspection_card_id = ? ORDER BY created_at')
        .all(card.inspection_card_id) as Array<Record<string, unknown>>;

      return { card: { ...card }, check_results: allResults, changed };
    });

    if ('notFound' in output && output.notFound) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }
    if ('immutable' in output && output.immutable) {
      return badRequest(`Card is ${output.status} and cannot be modified`, req.headers);
    }
    if ('invalidCheckCode' in output && output.invalidCheckCode) {
      return badRequest(`Invalid check_code: ${output.check_code}`, req.headers);
    }

    return NextResponse.json(output);
  } catch (e) {
    console.error('[inspection/cards/:id/check-results]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 }
    );
  }
}
