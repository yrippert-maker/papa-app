/**
 * GET /api/docs/versions?doc_id=...&limit=... — список версий документа (proxy к Portal API).
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const PORTAL_API_URL = (process.env.PORTAL_API_URL || '').trim();
const PORTAL_API_KEY = (process.env.PORTAL_API_KEY || '').trim();

export async function GET(req: NextRequest) {
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
    return NextResponse.json({ ok: false, error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
