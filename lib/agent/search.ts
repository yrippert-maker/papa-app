/**
 * AI Agent: семантический поиск по pgvector + fallback по имени файла.
 */
import pgvector from 'pgvector/pg';
import { getAgentDb } from './db';
import { embedOne } from './embed';
import type { SearchResult } from './types';

function normalizeKeyword(s: string): string {
  return s.replace(/[\s\-_/.\u2013\u2014—–]/g, '');
}

/** Поиск по filename/path (ILIKE + нормализованный вариант). source: 'keyword'. */
export async function searchDocsByKeyword(
  query: string,
  options: { topK?: number } = {}
): Promise<(SearchResult & { source?: 'keyword' })[]> {
  const topK = Math.min(options.topK ?? 8, 25);
  const qNorm = normalizeKeyword(query);

  const pool = await getAgentDb();
  let r: { rows: Array<Record<string, unknown>> };
  const whereClause =
    qNorm !== query
      ? `(d.filename ILIKE '%' || $1 || '%' OR d.path ILIKE '%' || $1 || '%'
         OR replace(replace(replace(d.filename, '-', ''), ' ', ''), '_', '') ILIKE '%' || $2 || '%'
         OR replace(replace(replace(d.path, '-', ''), ' ', ''), '_', '') ILIKE '%' || $2 || '%')`
      : `(d.filename ILIKE '%' || $1 || '%' OR d.path ILIKE '%' || $1 || '%')`;
  const params = qNorm !== query ? [query, qNorm, topK] : [query, topK];

  try {
    r = await pool.query(
      `SELECT d.id AS doc_id, d.path, d.filename, d.ext, d.sha256,
              GREATEST(similarity(d.filename, $1), similarity(d.path, $1)) AS sim
         FROM agent_docs d
         WHERE ${whereClause}
         ORDER BY sim DESC NULLS LAST, d.filename ASC
         LIMIT $${params.length}`,
      params as unknown[]
    );
  } catch {
    r = await pool.query(
      `SELECT d.id AS doc_id, d.path, d.filename, d.ext, d.sha256
         FROM agent_docs d
         WHERE ${whereClause}
         ORDER BY d.filename
         LIMIT $${params.length}`,
      params as unknown[]
    );
  }

  return r.rows.map((row) => {
    const score = typeof row.sim === 'number' ? Math.min(1, Math.max(0, row.sim)) : 0.9;
    const docId = String(row.doc_id ?? '');
    const path = String(row.path ?? '');
    const filename = String(row.filename ?? '');
    const ext = String(row.ext ?? '');
    const sha256 = String(row.sha256 ?? '');
    return {
      docId,
      chunkId: undefined,
      path,
      filename,
      ext,
      sha256,
      score,
      snippet: `Совпадение по имени: ${filename}`,
      source: 'keyword' as const,
    };
  });
}

/** @deprecated Use searchDocsByKeyword */
export async function searchDocsByFilename(
  query: string,
  options: { topK?: number } = {}
): Promise<(SearchResult & { source?: 'keyword' })[]> {
  return searchDocsByKeyword(query, options);
}

export async function searchDocs(
  query: string,
  options: { topK?: number; ext?: string[]; pathPrefix?: string } = {}
): Promise<SearchResult[]> {
  const topK = Math.min(options.topK ?? 8, 50);
  const embedding = await embedOne(query);
  const vecSql = pgvector.toSql(embedding);

  const pool = await getAgentDb();
  const client = await pool.connect();

  try {
    const r = await client.query(
      `SELECT d.id AS doc_id, d.path, d.filename, d.ext, d.sha256,
        c.id AS chunk_id, c.content AS snippet,
        1 - (c.embedding <=> $1::vector) AS score
       FROM agent_doc_chunks c
       JOIN agent_docs d ON d.id = c.doc_id
       ORDER BY c.embedding <=> $1::vector
       LIMIT $2`,
      [vecSql, topK]
    );

    return r.rows.map((row) => ({
      docId: row.doc_id,
      chunkId: row.chunk_id,
      path: row.path,
      filename: row.filename,
      ext: row.ext,
      sha256: row.sha256,
      score: Number(row.score),
      snippet: (row.snippet ?? '').slice(0, 300),
    }));
  } finally {
    client.release();
  }
}
