/**
 * GET /api/anchoring/issues
 * Structured issues: failed anchors, pending > 72h, receipt missing, gaps (optional).
 * For QA/admin quick view.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { getDbReadOnly, dbGet, dbAll } from '@/lib/db';
import { join } from 'path';
import { existsSync } from 'fs';
import { WORKSPACE_ROOT } from '@/lib/config';
import type { AnchoringIssuesResponse, AnchoringIssue } from '@/lib/types/anchoring-issues';
import { issueFingerprint } from '@/lib/issue-fingerprint';

export const dynamic = 'force-dynamic';

const PENDING_THRESHOLD_HOURS = 72;
const RECEIPTS_DIR = join(WORKSPACE_ROOT, '00_SYSTEM', 'anchor-receipts');

function parseIntSafe(v: string | null, def: number): number {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : def;
}

export async function GET(req: NextRequest): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.WORKSPACE_READ, req);
  if (err) return err;

  try {
    const url = new URL(req.url);
    const windowDays = Math.min(365, Math.max(1, parseIntSafe(url.searchParams.get('windowDays'), 30)));
    const checkGaps = url.searchParams.get('checkGaps') === 'true';

    const db = await getDbReadOnly();
    const tableExists = await dbGet(db, "SELECT name FROM sqlite_master WHERE type='table' AND name='ledger_anchors'");
    if (!tableExists) {
      return NextResponse.json({
        windowDays,
        generatedAt: new Date().toISOString(),
        issues: [],
      } satisfies AnchoringIssuesResponse);
    }

    const now = new Date();
    const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
    const windowStartStr = windowStart.toISOString().slice(0, 10) + 'T00:00:00.000Z';
    const pendingThreshold = new Date(now.getTime() - PENDING_THRESHOLD_HOURS * 60 * 60 * 1000);
    const pendingThresholdStr = pendingThreshold.toISOString();

    const issues: AnchoringIssue[] = [];

    // 1) failed anchors
    const failed = (await dbAll(db,
      `SELECT id, period_start, period_end, status FROM ledger_anchors
       WHERE period_start >= ? AND status = 'failed'
       ORDER BY period_start DESC`,
      windowStartStr
    )) as Array<{ id: string; period_start: string; period_end: string; status: string }>;

    for (const a of failed) {
      issues.push({
        id: `failed:${a.id}`,
        type: 'ANCHOR_FAILED',
        severity: 'critical',
        anchorId: a.id,
        periodStart: new Date(a.period_start).toISOString(),
        periodEnd: new Date(a.period_end).toISOString(),
        message: `Anchor FAILED for period ${new Date(a.period_start).toISOString().slice(0, 10)}.`,
        actionHref: `/governance/anchoring?status=failed&anchorId=${encodeURIComponent(a.id)}`,
      });
    }

    // 2) pending too long (>72h)
    const pendingTooLong = (await dbAll(db,
      `SELECT id, period_start, period_end, created_at, tx_hash FROM ledger_anchors
       WHERE period_start >= ? AND status = 'pending' AND created_at < ?
       ORDER BY created_at ASC`,
      windowStartStr, pendingThresholdStr
    )) as Array<{
      id: string;
      period_start: string;
      period_end: string;
      created_at: string;
      tx_hash: string | null;
    }>;

    for (const a of pendingTooLong) {
      issues.push({
        id: `pendingTooLong:${a.id}`,
        type: 'ANCHOR_PENDING_TOO_LONG',
        severity: 'major',
        anchorId: a.id,
        periodStart: new Date(a.period_start).toISOString(),
        periodEnd: new Date(a.period_end).toISOString(),
        txHash: a.tx_hash ?? undefined,
        message: `Anchor pending >72h for period ${new Date(a.period_start).toISOString().slice(0, 10)}.`,
        actionHref: `/governance/anchoring?status=pending&anchorId=${encodeURIComponent(a.id)}`,
      });
    }

    // 3) receipt missing for confirmed anchors (filesystem check)
    const confirmed = (await dbAll(db,
      `SELECT id, period_start, period_end, tx_hash, status FROM ledger_anchors
       WHERE period_start >= ? AND status = 'confirmed'
       ORDER BY period_start DESC`,
      windowStartStr
    )) as Array<{
      id: string;
      period_start: string;
      period_end: string;
      tx_hash: string | null;
      status: string;
    }>;

    for (const a of confirmed) {
      if (a.tx_hash) {
        const hex = a.tx_hash.replace(/^0x/, '');
        const receiptPath = join(RECEIPTS_DIR, `${hex}.json`);
        const receiptExists = existsSync(receiptPath);
        if (!receiptExists) {
          issues.push({
            id: `receiptMissing:${a.id}`,
            type: 'RECEIPT_MISSING_FOR_CONFIRMED',
            severity: 'major',
            anchorId: a.id,
            periodStart: new Date(a.period_start).toISOString(),
            periodEnd: new Date(a.period_end).toISOString(),
            txHash: a.tx_hash,
            message: `Receipt not recorded for confirmed anchor (tx ${a.tx_hash.slice(0, 10)}…).`,
            actionHref: `/governance/anchoring?anchorId=${encodeURIComponent(a.id)}`,
          });
        }
      }
    }

    // 4) gaps in periods (optional)
    if (checkGaps) {
      const rows = (await dbAll(db,
        `SELECT id, period_start, period_end, status FROM ledger_anchors
         WHERE period_start >= ? ORDER BY period_start ASC`,
        windowStartStr
      )) as Array<{ id: string; period_start: string; period_end: string; status: string }>;

      for (let i = 1; i < rows.length; i++) {
        const prev = rows[i - 1];
        const cur = rows[i];
        const prevEnd = new Date(prev.period_end).toISOString();
        const curStart = new Date(cur.period_start).toISOString();
        if (prevEnd !== curStart) {
          issues.push({
            id: `gap:${prev.id}:${cur.id}`,
            type: 'GAP_IN_PERIODS',
            severity: 'major',
            periodStart: prevEnd,
            periodEnd: curStart,
            message: `Gap detected between periods: ${prevEnd.slice(0, 10)} → ${curStart.slice(0, 10)}.`,
            actionHref: '/governance/anchoring',
          });
        }
      }
    }

    const issuesWithFp = issues.map((i) => ({
      ...i,
      _fingerprint: issueFingerprint(i),
    }));

    const resp: AnchoringIssuesResponse = {
      windowDays,
      generatedAt: new Date().toISOString(),
      issues: issuesWithFp,
    };

    return NextResponse.json(resp);
  } catch (e) {
    console.error('[anchoring/issues]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 }
    );
  }
}
