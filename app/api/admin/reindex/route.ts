/**
 * POST /api/admin/reindex
 * Переиндексация документов из DOCS_ROOT_DIR.
 * При DATABASE_URL — pgvector; иначе SQLite FTS5.
 * Требует ADMIN.MANAGE_USERS.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { getDocsDbWrite } from '@/lib/docs-agent-db';
import { indexDocuments } from '@/lib/docs-agent-index';
import { indexDocs } from '@/lib/agent/indexer';

export const dynamic = 'force-dynamic';

export async function POST(): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.ADMIN_MANAGE_USERS, new Request('http://x'));
  if (err) return err;

  try {
    if (process.env.DATABASE_URL) {
      const result = await indexDocs();
      return NextResponse.json({
        indexed: result.indexed,
        chunks: result.chunks,
        errors: result.errors,
      });
    }

    const db = await getDocsDbWrite();
    const indexDb = {
      exec: (sql: string) => db.exec(sql),
      run: async (sql: string, ...params: unknown[]) => {
        const stmt = await db.prepare(sql);
        return stmt.run(...params);
      },
    };
    const result = await indexDocuments(indexDb);
    return NextResponse.json({
      indexed: result.indexed,
      chunks: result.chunks,
      errors: result.errors,
    });
  } catch (e) {
    console.error('[admin/reindex]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Reindex failed' },
      { status: 500 }
    );
  }
}
