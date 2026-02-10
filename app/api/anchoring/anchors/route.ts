/**
 * GET /api/anchoring/anchors
 * List anchors for /governance/anchoring table.
 * Query: from, to (ISO date), status?, limit?, offset?
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { getDbReadOnly, dbGet, dbAll } from '@/lib/db';
import type { AnchorListItem, AnchorListResponse, AnchorRowStatus } from '@/lib/types/anchoring';

export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 100;

function mapStatus(s: string): AnchorRowStatus {
  if (s === 'confirmed' || s === 'empty' || s === 'failed' || s === 'pending') return s;
  return 'pending';
}

export async function GET(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.WORKSPACE_READ, req);
  if (err) return err;

  try {
    const url = new URL(req.url);
    const from = url.searchParams.get('from') ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const to = url.searchParams.get('to') ?? new Date().toISOString().slice(0, 10);
    const status = url.searchParams.get('status') as AnchorRowStatus | null;
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, MAX_LIMIT);
    const offset = Math.max(0, parseInt(url.searchParams.get('offset') ?? '0', 10) || 0);

    const db = await getDbReadOnly();
    const tableExists = await dbGet(db, "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename='ledger_anchors'");
    if (!tableExists) {
      return NextResponse.json({
        network: 'polygon',
        chainId: 137,
        range: { from, to },
        items: [],
        page: { limit, offset, total: 0 },
      } satisfies AnchorListResponse);
    }

    const periodStartFrom = from + 'T00:00:00.000Z';
    const periodStartTo = to + 'T00:00:00.000Z'; // to is exclusive

    let where = 'period_start >= ? AND period_start < ?';
    const params: unknown[] = [periodStartFrom, periodStartTo];
    if (status) {
      where += ' AND status = ?';
      params.push(status);
    }

    const totalRow = (await dbGet(db, `SELECT COUNT(*) as c FROM ledger_anchors WHERE ${where}`, ...params)) as { c: number };
    const total = totalRow?.c ?? 0;

    const rows = (await dbAll(db,
      `SELECT id, period_start, period_end, events_count, status, merkle_root, network, chain_id,
              contract_address, tx_hash, block_number, log_index, anchored_at, created_at
       FROM ledger_anchors WHERE ${where}
       ORDER BY period_start DESC LIMIT ? OFFSET ?`,
      ...params, limit, offset
    )) as Array<{
      id: string;
      period_start: string;
      period_end: string;
      events_count: number;
      status: string;
      merkle_root: string | null;
      network: string | null;
      chain_id: string | null;
      contract_address: string | null;
      tx_hash: string | null;
      block_number: number | null;
      log_index: number | null;
      anchored_at: string | null;
      created_at: string;
    }>;

    const items: AnchorListItem[] = rows.map((r) => ({
      anchorId: r.id,
      periodStart: r.period_start,
      periodEnd: r.period_end,
      eventsCount: r.events_count,
      status: mapStatus(r.status),
      hashAlgo: 'sha256',
      merkleRoot: r.merkle_root,
      network: (r.network as 'polygon') ?? 'polygon',
      chainId: r.chain_id ? parseInt(r.chain_id, 10) : 137,
      contractAddress: r.contract_address,
      txHash: r.tx_hash,
      blockNumber: r.block_number,
      logIndex: r.log_index,
      anchoredAt: r.anchored_at,
      createdAt: r.created_at,
    }));

    return NextResponse.json({
      network: 'polygon',
      chainId: 137,
      range: { from, to },
      items,
      page: { limit, offset, total },
    } satisfies AnchorListResponse);
  } catch (e) {
    console.error('[anchoring/anchors]', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'List failed' }, { status: 500 });
  }
}
