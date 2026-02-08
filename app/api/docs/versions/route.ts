/**
 * GET /api/docs/versions?doc_id=...&limit=... — список версий документа (proxy к Portal API).
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

  const docId = req.nextUrl.searchParams.get('doc_id');
  const limit = req.nextUrl.searchParams.get('limit') || '100';
  if (!docId) return NextResponse.json({ ok: false, error: 'missing doc_id' }, { status: 400 });
  if (!PORTAL_API_URL) return NextResponse.json({ ok: false, error: 'PORTAL_API_URL not configured' }, { status: 503 });
  try {
    const url = `${PORTAL_API_URL.replace(/\/+$/, '')}/v1/docs/versions?doc_id=${encodeURIComponent(docId)}&limit=${encodeURIComponent(limit)}`;
    const res = await fetch(url, {
      headers: PORTAL_API_KEY ? { 'x-api-key': PORTAL_API_KEY } : {},
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json({ ok: false, error: data.error || res.statusText }, { status: res.status });
    return NextResponse.json({ ok: true, doc_id: data.doc_id, versions: data.versions ?? [] });
  } catch (e) {
    return internalError('docs/versions', e, req?.headers);
  }
}
