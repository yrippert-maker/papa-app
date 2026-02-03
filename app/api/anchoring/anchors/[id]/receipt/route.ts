/**
 * GET /api/anchoring/anchors/:id/receipt
 * Download receipt JSON for anchor (if available).
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { getDbReadOnly } from '@/lib/db';
import { join } from 'path';
import { readFileSync, existsSync } from 'fs';
import { WORKSPACE_ROOT } from '@/lib/config';

export const dynamic = 'force-dynamic';

const RECEIPTS_DIR = join(WORKSPACE_ROOT, '00_SYSTEM', 'anchor-receipts');

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const err = requirePermission(session, PERMISSIONS.WORKSPACE_READ, _req);
  if (err) return err;

  try {
    const { id } = await params;
    const db = getDbReadOnly();

    const row = db.prepare('SELECT tx_hash FROM ledger_anchors WHERE id = ?').get(id) as {
      tx_hash: string | null;
    } | undefined;

    if (!row || !row.tx_hash) {
      return NextResponse.json({ error: 'Receipt not available' }, { status: 404 });
    }

    const hex = row.tx_hash.replace(/^0x/, '');
    const receiptPath = join(RECEIPTS_DIR, `${hex}.json`);

    if (!existsSync(receiptPath)) {
      return NextResponse.json({ error: 'Receipt file not found' }, { status: 404 });
    }

    const content = readFileSync(receiptPath, 'utf8');
    const json = JSON.parse(content);

    return new NextResponse(JSON.stringify(json, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="receipt-${id}.json"`,
      },
    });
  } catch (e) {
    console.error('[anchoring/anchors/:id/receipt]', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}
