/**
 * GET /api/proof/artifact?sha256=...
 * Find events by artifact SHA-256.
 */
import { NextResponse } from 'next/server';
import { getEventsByArtifact } from '@/lib/ledger-anchoring-service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sha256 = searchParams.get('sha256');
    if (!sha256 || !/^[a-f0-9]{64}$/i.test(sha256)) {
      return NextResponse.json({ error: 'sha256 query param required (64 hex chars)' }, { status: 400 });
    }
    const events = getEventsByArtifact(sha256);
    return NextResponse.json({
      artifact_sha256: sha256,
      events: events.map((e) => ({
        id: e.id,
        event_type: e.event_type,
        created_at: e.created_at,
        actor_id: e.actor_id,
        block_hash: e.block_hash,
        anchor_id: e.anchor_id,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
