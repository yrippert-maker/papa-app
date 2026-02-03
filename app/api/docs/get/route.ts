/**
 * GET /api/docs/get?doc_id=... — текущая версия документа (proxy к Portal API).
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const PORTAL_API_URL = (process.env.PORTAL_API_URL || '').trim();
const PORTAL_API_KEY = (process.env.PORTAL_API_KEY || '').trim();

export async function GET(req: NextRequest) {
  const docId = req.nextUrl.searchParams.get('doc_id');
  if (!docId) return NextResponse.json({ ok: false, error: 'missing doc_id' }, { status: 400 });
  if (!PORTAL_API_URL) return NextResponse.json({ ok: false, error: 'PORTAL_API_URL not configured' }, { status: 503 });
  try {
    const url = `${PORTAL_API_URL.replace(/\/+$/, '')}/v1/docs/get?doc_id=${encodeURIComponent(docId)}`;
    const res = await fetch(url, {
      headers: PORTAL_API_KEY ? { 'x-api-key': PORTAL_API_KEY } : {},
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json({ ok: false, error: data.error || res.statusText }, { status: res.status });
    const doc = data.doc ?? data;
    return NextResponse.json({ ok: true, doc_id: doc.doc_id, content: doc.content, format: doc.format });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
