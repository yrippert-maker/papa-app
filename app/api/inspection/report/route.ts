import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getDbReadOnly } from '@/lib/db';
import { requirePermissionWithAlias, PERMISSIONS } from '@/lib/authz';
import { badRequest } from '@/lib/api/error-response';

export const dynamic = 'force-dynamic';

/**
 * GET /api/inspection/report — агрегированный отчёт по техкартам.
 * Permission: INSPECTION.VIEW.
 * Query: kind=INPUT|OUTPUT, status=..., from_date, to_date (ISO date, optional).
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const err = requirePermissionWithAlias(session, PERMISSIONS.INSPECTION_VIEW, request);
  if (err) return err;

  try {
    const url = new URL(request.url);
    const kind = url.searchParams.get('kind') as 'INPUT' | 'OUTPUT' | null;
    const status = url.searchParams.get('status') as string | null;
    const fromDate = url.searchParams.get('from_date') ?? '';
    const toDate = url.searchParams.get('to_date') ?? '';

    const db = getDbReadOnly();

    let cardsWhere = '1=1';
    const cardsParams: (string | number)[] = [];
    if (kind) {
      cardsWhere += ' AND c.card_kind = ?';
      cardsParams.push(kind);
    }
    if (status) {
      cardsWhere += ' AND c.status = ?';
      cardsParams.push(status);
    }
    if (fromDate && /^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
      cardsWhere += ' AND date(c.created_at) >= ?';
      cardsParams.push(fromDate);
    }
    if (toDate && /^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
      cardsWhere += ' AND date(c.created_at) <= ?';
      cardsParams.push(toDate);
    }

    const totalCards = db
      .prepare(
        `SELECT COUNT(*) as c FROM inspection_card c WHERE ${cardsWhere}`
      )
      .get(...cardsParams) as { c: number };
    const total = totalCards?.c ?? 0;

    const byStatus = db
      .prepare(
        `SELECT c.status, COUNT(*) as cnt FROM inspection_card c WHERE ${cardsWhere} GROUP BY c.status`
      )
      .all(...cardsParams) as Array<{ status: string; cnt: number }>;

    const completedCount = byStatus.find((r) => r.status === 'COMPLETED')?.cnt ?? 0;
    const cancelledCount = byStatus.find((r) => r.status === 'CANCELLED')?.cnt ?? 0;
    const activeTotal = total - cancelledCount;
    const completionRate = activeTotal > 0 ? Math.round((completedCount / activeTotal) * 100) : 0;

    const resultsQuery = `
      SELECT r.check_code, r.result, COUNT(*) as cnt
      FROM inspection_check_result r
      INNER JOIN inspection_card c ON c.inspection_card_id = r.inspection_card_id
      WHERE ${cardsWhere}
      GROUP BY r.check_code, r.result
    `;
    const resultsByCheck = db.prepare(resultsQuery).all(...cardsParams) as Array<{
      check_code: string;
      result: string;
      cnt: number;
    }>;

    const breakdown: Record<string, { PASS: number; FAIL: number; NA: number }> = {};
    for (const row of resultsByCheck) {
      if (!breakdown[row.check_code]) {
        breakdown[row.check_code] = { PASS: 0, FAIL: 0, NA: 0 };
      }
      breakdown[row.check_code][row.result as 'PASS' | 'FAIL' | 'NA'] = row.cnt;
    }

    const failTotal = Object.values(breakdown).reduce((s, b) => s + b.FAIL, 0);
    const resultTotal = Object.values(breakdown).reduce((s, b) => s + b.PASS + b.FAIL + b.NA, 0);
    const failRate = resultTotal > 0 ? Math.round((failTotal / resultTotal) * 100) : 0;

    return NextResponse.json({
      total_cards: total,
      by_status: Object.fromEntries(byStatus.map((r) => [r.status, r.cnt])),
      completion_rate_pct: completionRate,
      fail_rate_pct: failRate,
      breakdown_by_check_code: breakdown,
      filters: { kind: kind ?? null, status: status ?? null, from_date: fromDate || null, to_date: toDate || null },
    });
  } catch (e) {
    if (e instanceof Error && /^Invalid/.test(e.message)) {
      return badRequest(e.message, request.headers);
    }
    console.error('[inspection/report]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 }
    );
  }
}
