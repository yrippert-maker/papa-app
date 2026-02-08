/**
 * POST /api/agent/search
 * Поиск по документам: pgvector (при DATABASE_URL) или SQLite FTS5.
 * Требует FILES.LIST.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { getDocsDb } from '@/lib/docs-agent-db';
import { searchDocuments } from '@/lib/docs-agent-search';
import { searchDocs, searchDocsByKeyword } from '@/lib/agent/search';
import { dbAll } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await getServerSession(authOptions);
    const err = await requirePermission(session, PERMISSIONS.FILES_LIST, request);
    if (err) return err;
    const body = await request.json().catch(() => ({}));
    const rawQuery = typeof body.query === 'string' ? body.query : '';
    // Нормализация: em-dash/en-dash → hyphen (FTS5 не нормализует)
    const query = rawQuery.replace(/[\u2013\u2014—–]/g, '-').trim();
    const topK = Math.min(Math.max(Number(body.topK) || 8, 1), 50);
    const filters = body.filters ?? {};
    const mode = (body.mode ?? 'hybrid') as 'semantic' | 'keyword' | 'hybrid';

    if (!query) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 });
    }

    if (process.env.DATABASE_URL) {
      let results: Awaited<ReturnType<typeof searchDocs>> | Awaited<ReturnType<typeof searchDocsByKeyword>> = [];
      let fallbackSource: string | undefined;

      if (mode === 'semantic' || mode === 'hybrid') {
        results = await searchDocs(query, {
          topK,
          ext: filters.ext,
          pathPrefix: filters.pathPrefix,
        });
      }
      if (mode === 'keyword' || (mode === 'hybrid' && results.length === 0)) {
        const kw = await searchDocsByKeyword(query, { topK });
        if (kw.length > 0) {
          results = kw;
          fallbackSource = 'keyword';
        }
      }

      return NextResponse.json({
        results: results.map((r) => {
          const score = r.score;
          const confidence = Math.min(1, Math.max(0, typeof score === 'number' ? score : 0));
          return {
            docId: r.docId,
            chunkId: (r as { chunkId?: string }).chunkId,
            title: r.filename,
            path: r.path,
            sha256: (r as { sha256?: string }).sha256,
            score,
            confidence,
            snippet: r.snippet,
            highlights: r.highlights,
            source: (r as { source?: string }).source,
          };
        }),
        meta: { q: query, mode },
        fallbackSource: fallbackSource ?? undefined,
      });
    }

    const db = await getDocsDb();
    const searchDb = {
      all: <T,>(sql: string, ...params: unknown[]) => dbAll<T>(db, sql, ...params),
    };
    const results = await searchDocuments(searchDb, query, {
      topK,
      ext: filters.ext,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    });
    return NextResponse.json({
      results: results.map((r) => {
        const score = r.score;
        const confidence = Math.min(1, Math.max(0, typeof score === 'number' ? score : 0));
        return {
          docId: r.docId,
          chunkId: r.chunkId,
          title: r.title,
          path: r.path,
          score,
          confidence,
          snippet: r.snippet,
          highlights: r.highlights,
        };
      }),
    });
  } catch (e) {
    if (e instanceof Error && e.message.includes('no such table')) {
      return NextResponse.json({
        results: [],
        warning: 'Index not built. Run: npm run docs:index:agent:seed',
      });
    }
    if (e instanceof Error && e.message.includes('DATABASE_URL')) {
      return NextResponse.json({
        results: [],
        warning: 'pgvector requires DATABASE_URL. Use SQLite: npm run docs:index:agent:seed',
      });
    }
    if (e instanceof Error && e.message.includes('Workspace database not found')) {
      return NextResponse.json({
        results: [],
        warning: 'Run: npm run migrate && npm run docs:index:agent:seed',
      });
    }
    console.error('[agent/search]', e);
    // Пилот: лучше пустой результат + warning, чем HTML error page
    return NextResponse.json({
      results: [],
      warning: 'Search temporarily unavailable',
    });
  }
}
