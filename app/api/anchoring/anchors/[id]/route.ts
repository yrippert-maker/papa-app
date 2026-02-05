/**
 * GET /api/anchoring/anchors/:id
 * Anchor details for drawer (Summary + Proof + Evidence).
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { getDbReadOnly, dbGet } from '@/lib/db';
import { getReceiptSha256 } from '@/lib/anchoring-health-service';
import { join } from 'path';
import { existsSync } from 'fs';
import { WORKSPACE_ROOT } from '@/lib/config';
import type { AnchorDetailResponse, AnchorListItem, AnchorRowStatus } from '@/lib/types/anchoring';

export const dynamic = 'force-dynamic';

const RECEIPTS_DIR = join(WORKSPACE_ROOT, '00_SYSTEM', 'anchor-receipts');

function mapStatus(s: string): AnchorRowStatus {
  if (s === 'confirmed' || s === 'empty' || s === 'failed' || s === 'pending') return s;
  return 'pending';
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.WORKSPACE_READ, _req);
  if (err) return err;

  try {
    const { id } = await params;
    const db = await getDbReadOnly();

    const row = (await dbGet(db, 'SELECT * FROM ledger_anchors WHERE id = ?', id)) as {
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
    } | undefined;

    if (!row) return NextResponse.json({ error: 'Anchor not found' }, { status: 404 });

    const anchor: AnchorListItem = {
      anchorId: row.id,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      eventsCount: row.events_count,
      status: mapStatus(row.status),
      hashAlgo: 'sha256',
      merkleRoot: row.merkle_root,
      network: (row.network as 'polygon') ?? 'polygon',
      chainId: row.chain_id ? parseInt(row.chain_id, 10) : 137,
      contractAddress: row.contract_address,
      txHash: row.tx_hash,
      blockNumber: row.block_number,
      logIndex: row.log_index,
      anchoredAt: row.anchored_at,
      createdAt: row.created_at,
    };

    let receiptAvailable = false;
    let receiptSha256: string | null = null;
    let pathInPack: string | null = null;

    if (row.tx_hash) {
      const hex = row.tx_hash.replace(/^0x/, '');
      const receiptPath = join(RECEIPTS_DIR, `${hex}.json`);
      receiptAvailable = existsSync(receiptPath);
      receiptSha256 = getReceiptSha256(row.tx_hash);
      if (receiptAvailable) pathInPack = `onchain/receipts/${hex}.json`;
    }

    const verification = {
      signatureChainOk: row.status === 'confirmed',
      merkleOk: !!row.merkle_root,
      onchainEventOk: row.status === 'confirmed' && !!row.tx_hash,
      notes: [] as string[],
    };

    const body: AnchorDetailResponse = {
      anchor,
      receipt: { available: receiptAvailable, sha256: receiptSha256, pathInPack },
      verification,
    };

    return NextResponse.json(body);
  } catch (e) {
    console.error('[anchoring/anchors/:id]', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}
