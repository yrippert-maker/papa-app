/**
 * GET /api/proof/anchor/:id
 * Anchor details (Merkle root, tx, status).
 */
import { NextResponse } from 'next/server';
import { getAnchor } from '@/lib/ledger-anchoring-service';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const anchor = await getAnchor(id);
    if (!anchor) return NextResponse.json({ error: 'Anchor not found' }, { status: 404 });
    return NextResponse.json(anchor);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
