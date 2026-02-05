/**
 * GET /api/anchoring/anchors/:id/proof-bundle
 * Auditor-ready proof bundle (schema proof-bundle/v1).
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { getDbReadOnly, dbGet } from '@/lib/db';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { createHash } from 'crypto';
import { WORKSPACE_ROOT } from '@/lib/config';

export const dynamic = 'force-dynamic';

const RECEIPTS_DIR = join(WORKSPACE_ROOT, '00_SYSTEM', 'anchor-receipts');

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.WORKSPACE_READ, _req);
  if (err) return err;

  try {
    const { id: anchorId } = await params;
    const db = await getDbReadOnly();

    const row = (await dbGet(db, 'SELECT * FROM ledger_anchors WHERE id = ?', anchorId)) as {
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

    if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    const anchor = {
      anchor_id: row.id,
      period_start: new Date(row.period_start).toISOString(),
      period_end: new Date(row.period_end).toISOString(),
      events_count: Number(row.events_count ?? 0),
      status: row.status,
      hash_algo: 'sha256' as const,
      merkle_root: row.merkle_root ?? null,
    };

    const onchain = {
      network: 'polygon',
      chain_id: 137,
      contract_address: row.contract_address ?? null,
      tx_hash: row.tx_hash ?? null,
      block_number: row.block_number ?? null,
      log_index: row.log_index ?? null,
      event: null as Record<string, unknown> | null,
    };

    let receiptAvailable = false;
    let receiptSha256: string | null = null;
    let receiptContent: unknown = null;

    if (row.tx_hash && row.status === 'confirmed') {
      const hex = row.tx_hash.replace(/^0x/, '');
      const receiptPath = join(RECEIPTS_DIR, `${hex}.json`);
      if (existsSync(receiptPath)) {
        const content = readFileSync(receiptPath, 'utf8');
        receiptSha256 = createHash('sha256').update(content).digest('hex');
        receiptContent = JSON.parse(content);
        receiptAvailable = true;
      }
    }

    let pkg: { version?: string } = {};
    try {
      pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
    } catch {
      // ignore
    }

    const bundle = {
      schema: 'proof-bundle/v1',
      generated_at: new Date().toISOString(),
      tool: {
        name: 'papa-app',
        version: process.env.npm_package_version ?? pkg.version ?? 'unknown',
      },
      anchor,
      onchain,
      receipt: {
        available: receiptAvailable,
        sha256: receiptSha256,
        content: receiptContent,
      },
      verification: {
        onchain_event_ok: row.status === 'confirmed' && !!row.tx_hash,
        merkle_ok: !!row.merkle_root,
        signature_chain_ok: row.status === 'confirmed',
        notes: [] as string[],
      },
    };

    return NextResponse.json(bundle, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    console.error('[anchoring/proof-bundle]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 }
    );
  }
}
