/**
 * GET /api/proof/anchor/:id
 * Anchor details (Merkle root, tx, status).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { checkRateLimit, getClientKey } from '@/lib/rate-limit';
import { getAnchor } from '@/lib/ledger-anchoring-service';
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
    const { id } = await params;
    const anchor = await getAnchor(id);
    if (!anchor) return NextResponse.json({ error: 'Anchor not found' }, { status: 404 });
    return NextResponse.json(anchor);
  } catch (e) {
    return internalError('[proof/anchor/:id]', e, req?.headers);
  }
}
