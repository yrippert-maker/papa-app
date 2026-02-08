/**
 * GET /api/docs/list — список doc_id (proxy к Portal API Document Store).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { internalError } from '@/lib/api/error-response';

export const dynamic = 'force-dynamic';

const PORTAL_API_URL = (process.env.PORTAL_API_URL || '').trim();
const PORTAL_API_KEY = (process.env.PORTAL_API_KEY || '').trim();

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.DOC_VIEW, req);
  if (err) return err;

  if (!PORTAL_API_URL) return NextResponse.json({ ok: false, doc_ids: [], error: 'PORTAL_API_URL not configured' });
  try {
    const url = `${PORTAL_API_URL.replace(/\/+$/, '')}/v1/docs/list`;
    const res = await fetch(url, {
      headers: PORTAL_API_KEY ? { 'x-api-key': PORTAL_API_KEY } : {},
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json({ ok: false, doc_ids: [], error: data.error || res.statusText }, { status: res.status });
    return NextResponse.json({ ok: true, doc_ids: data.doc_ids ?? [] });
  } catch (e) {
    return internalError('docs/list', e, req?.headers);
  }
}
