/**
 * GET /api/proof/event/:id
 * Event proof: payload, signature, chain, anchor.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { checkRateLimit, getClientKey } from '@/lib/rate-limit';
import { getEventProof } from '@/lib/ledger-anchoring-service';
import { internalError } from '@/lib/api/error-response';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const key = getClientKey(req);
  const { allowed, retryAfterMs } = checkRateLimit(key, { windowMs: 60_000, max: 10 });
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: retryAfterMs ? { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } : undefined }
    );
  }

  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.LEDGER_READ, req);
  if (err) return err;

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
    return internalError('[proof/event/:id]', e, req?.headers);
  }
}
