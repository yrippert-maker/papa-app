/**
 * GET /api/proof/artifact?sha256=...
 * Find events by artifact SHA-256.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { checkRateLimit, getClientKey } from '@/lib/rate-limit';
import { getEventsByArtifact } from '@/lib/ledger-anchoring-service';
import { internalError } from '@/lib/api/error-response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
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
    const { searchParams } = new URL(req.url);
    const sha256 = searchParams.get('sha256');
    if (!sha256 || !/^[a-f0-9]{64}$/i.test(sha256)) {
      return NextResponse.json({ error: 'sha256 query param required (64 hex chars)' }, { status: 400 });
    }
    const events = await getEventsByArtifact(sha256);
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
    return internalError('[proof/artifact]', e, req?.headers);
  }
}
