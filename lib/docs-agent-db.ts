/**
 * AI Agent: доступ к индексу документов (SQLite FTS5).
 * Индекс всегда в workspace SQLite, независимо от DATABASE_URL (Prisma/Postgres).
 */
import { existsSync } from 'fs';
import { createSqliteAdapter } from '@/lib/adapters/sqlite-adapter';
import { DB_PATH } from '@/lib/config';

let docsAdapter: Awaited<ReturnType<typeof createSqliteAdapter>> | null = null;

/** Возвращает адаптер для docs index (workspace SQLite). Таблицы doc_metadata, doc_chunks, doc_chunks_fts. */
export async function getDocsDb() {
  if (docsAdapter) return docsAdapter;
  if (!existsSync(DB_PATH)) {
    throw new Error('Workspace database not found. Run: npm run migrate');
  }
  docsAdapter = createSqliteAdapter({ mode: 'readonly' });
  return docsAdapter;
}

/** Read-write для индексации (reindex API). */
export async function getDocsDbWrite() {
  const { createSqliteAdapter } = await import('@/lib/adapters/sqlite-adapter');
  return createSqliteAdapter({ mode: 'readwrite' });
}
