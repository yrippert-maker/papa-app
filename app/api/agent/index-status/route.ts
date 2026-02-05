/**
 * GET /api/agent/index-status?docId=...
 * Проверка: есть ли документ в agent_docs и есть ли чанки.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { getAgentDb } from '@/lib/agent/db';

export const dynamic = 'force-dynamic';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.FILES_LIST, request);
  if (err) return err;

  const url = new URL(request.url);
  const docId = url.searchParams.get('docId');
  if (!docId || !UUID_REGEX.test(docId)) {
    return NextResponse.json({ error: 'docId (UUID) required' }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ hasDoc: false, hasChunks: false, error: 'DATABASE_URL required' });
  }

  try {
    const pool = await getAgentDb();
    const r = await pool.query(
      `SELECT
         EXISTS(SELECT 1 FROM agent_docs WHERE id = $1) AS has_doc,
         EXISTS(SELECT 1 FROM agent_doc_chunks WHERE doc_id = $1) AS has_chunks`,
      [docId]
    );
    const row = r.rows[0];
    return NextResponse.json({
      hasDoc: Boolean(row?.has_doc),
      hasChunks: Boolean(row?.has_chunks),
    });
  } catch (e) {
    console.error('[agent/index-status]', e);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}
