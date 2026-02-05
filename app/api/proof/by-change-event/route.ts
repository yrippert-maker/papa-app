/**
 * GET /api/proof/by-change-event?changeEventId=ce-xxx
 * Находит ledger events по change_event_id в payload, возвращает proof последнего.
 */
import { NextResponse } from 'next/server';
import { getDb, dbGet } from '@/lib/db';
import { getEventProof } from '@/lib/ledger-anchoring-service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const changeEventId = searchParams.get('changeEventId');
    if (!changeEventId) {
      return NextResponse.json({ error: 'changeEventId required' }, { status: 400 });
    }

    const db = await getDb();
    const pattern = `%"change_event_id":"${changeEventId}"%`;
    const row = (await dbGet(db, `SELECT id FROM ledger_events WHERE payload_json LIKE ? ORDER BY id DESC LIMIT 1`, pattern)) as { id: number } | undefined;

    if (!row) {
      return NextResponse.json({ found: false, message: 'No ledger event for this change' }, { status: 404 });
    }

    const proof = await getEventProof(row.id);
    if (!proof) return NextResponse.json({ error: 'Proof not found' }, { status: 404 });

    return NextResponse.json({
      ledger_event_id: row.id,
      event: {
        id: proof.event.id,
        event_type: proof.event.event_type,
        created_at: proof.event.created_at,
        block_hash: proof.event.block_hash,
      },
      signature_valid: proof.signatureValid,
      chain_valid: proof.chainValid,
      anchor: proof.anchor,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
