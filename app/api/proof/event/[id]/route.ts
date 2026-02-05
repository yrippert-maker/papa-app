/**
 * GET /api/proof/event/:id
 * Event proof: payload, signature, chain, anchor.
 */
import { NextResponse } from 'next/server';
import { getEventProof } from '@/lib/ledger-anchoring-service';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = parseInt((await params).id, 10);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });
    const proof = await getEventProof(id);
    if (!proof) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    return NextResponse.json({
      event: {
        id: proof.event.id,
        event_type: proof.event.event_type,
        payload: JSON.parse(proof.event.payload_json),
        created_at: proof.event.created_at,
        actor_id: proof.event.actor_id,
        artifact_sha256: proof.event.artifact_sha256,
        artifact_ref: proof.event.artifact_ref,
        block_hash: proof.event.block_hash,
        prev_hash: proof.event.prev_hash,
      },
      signature: proof.event.signature ? { key_id: proof.event.key_id, valid: proof.signatureValid } : null,
      chain_valid: proof.chainValid,
      anchor: proof.anchor,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
