/**
 * GET /api/docs/get?doc_id=... — текущая версия документа (proxy к Portal API).
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
  if (!docId) return NextResponse.json({ ok: false, error: 'missing doc_id' }, { status: 400 });
  const apiBase = PORTAL_API_URL || (process.env.NEXTAUTH_URL || `http://localhost:${process.env.PORT || 3001}`).replace(/\/$/, '') + '/api';
  try {
    const url = `${apiBase.replace(/\/+$/, '')}/v1/docs/get?doc_id=${encodeURIComponent(docId)}`;
    const res = await fetch(url, {
      headers: PORTAL_API_KEY ? { 'x-api-key': PORTAL_API_KEY } : {},
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json({ ok: false, error: data.error || res.statusText }, { status: res.status });
    const doc = data.doc ?? data;
    const content = doc.content;
    const docs = (typeof content === 'object' && content && 'docs' in content) ? (content as { docs: unknown[] }).docs : undefined;
    return NextResponse.json({
      ok: true,
      doc_id: doc.doc_id,
      title: doc.title,
      annotation_ru: doc.annotation_ru,
      content,
      format: doc.format,
      ...(docs && { docs }),
    });
  } catch (e) {
    return internalError('docs/get', e, req?.headers);
  }
}
