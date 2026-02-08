/**
 * GET /api/proof/by-change-event?changeEventId=ce-xxx
 * Находит ledger events по change_event_id в payload, возвращает proof последнего.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { checkRateLimit, getClientKey } from '@/lib/rate-limit';
import { getDb, dbGet } from '@/lib/db';
import { getEventProof } from '@/lib/ledger-anchoring-service';
import { internalError } from '@/lib/api/error-response';
import { escapeLike } from '@/lib/sql-utils';

/** Validate changeEventId format (alphanumeric, _, -) */
const CHANGE_EVENT_ID_RE = /^[a-zA-Z0-9_-]{1,128}$/;

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
    const changeEventId = searchParams.get('changeEventId');
    if (!changeEventId) {
      return NextResponse.json({ error: 'changeEventId required' }, { status: 400 });
    }
    if (!CHANGE_EVENT_ID_RE.test(changeEventId)) {
      return NextResponse.json({ error: 'Invalid changeEventId format' }, { status: 400 });
    }

    const db = await getDb();
    const escaped = escapeLike(changeEventId);
    const pattern = `%"change_event_id":"${escaped}"%`;
    const row = (await dbGet(db, `SELECT id FROM ledger_events WHERE payload_json LIKE ? ESCAPE '\\' ORDER BY id DESC LIMIT 1`, pattern)) as { id: number } | undefined;

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
    return internalError('[proof/by-change-event]', e, req?.headers);
  }
}
