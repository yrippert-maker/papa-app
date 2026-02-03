/**
 * GET /api/docs/list — список doc_id (proxy к Portal API Document Store).
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const PORTAL_API_URL = (process.env.PORTAL_API_URL || '').trim();
const PORTAL_API_KEY = (process.env.PORTAL_API_KEY || '').trim();

export async function GET() {
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
    return NextResponse.json({ ok: false, doc_ids: [], error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
