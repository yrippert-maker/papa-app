/**
 * POST /api/documents/search — FR-4.4: полнотекстовый поиск по документам.
 * Прокси к agent search (семантический + keyword).
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { searchDocs, searchDocsByKeyword } from '@/lib/agent/search';
import { getDocsDb } from '@/lib/docs-agent-db';
import { searchDocuments } from '@/lib/docs-agent-search';
import { dbAll } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.FILES_LIST, request);
  if (err) return err;

  let body: { query?: string; topK?: number; mode?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const query = (typeof body.query === 'string' ? body.query : '').trim();
  if (!query) return NextResponse.json({ error: 'query is required' }, { status: 400 });
  const topK = Math.min(Math.max(Number(body.topK) || 20, 1), 50);
  const mode = (body.mode ?? 'hybrid') as 'semantic' | 'keyword' | 'hybrid';

  if (process.env.DATABASE_URL) {
    let results: Awaited<ReturnType<typeof searchDocs>> | Awaited<ReturnType<typeof searchDocsByKeyword>> = [];
    if (mode === 'semantic' || mode === 'hybrid') {
      results = await searchDocs(query, { topK });
    }
    if (mode === 'keyword' || (mode === 'hybrid' && results.length === 0)) {
      results = await searchDocsByKeyword(query, { topK });
    }
    return NextResponse.json({
      results: results.map((r) => ({
        docId: r.docId,
        path: r.path,
        title: r.filename,
        snippet: r.snippet,
        score: r.score,
      })),
    });
  }

  const db = await getDocsDb();
  const searchDb = {
    all: <T,>(sql: string, ...params: unknown[]) => dbAll<T>(db, sql, ...params),
  };
  const results = await searchDocuments(searchDb, query, { topK });
  return NextResponse.json({
    results: results.map((r) => ({
      docId: r.docId,
      path: r.path,
      title: r.title,
      snippet: r.snippet,
      score: r.score,
    })),
  });
}
