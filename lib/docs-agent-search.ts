/**
 * AI Agent: полнотекстовый поиск по индексированным документам.
 * Использует FTS5 (SQLite).
 */
export type SearchResult = {
  docId: string;
  chunkId: string;
  title: string;
  path: string;
  score: number;
  snippet: string;
  highlights: string[];
};

export type SearchDb = {
  all: <T = unknown>(sql: string, ...params: unknown[]) => Promise<T[]>;
};

export async function searchDocuments(
  db: SearchDb,
  query: string,
  options: { topK?: number; ext?: string[]; dateFrom?: string; dateTo?: string } = {}
): Promise<SearchResult[]> {
  const topK = options.topK ?? 8;

  // Нормализация: em-dash/en-dash → hyphen (FTS5 не нормализует)
  const normalized = query.replace(/[\u2013\u2014—–]/g, '-').trim();

  // FTS5: escape double quotes, join terms (AND by default)
  const ftsQuery = normalized
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => `"${t.replace(/"/g, '""')}"`)
    .join(' ');

  if (!ftsQuery) return [];

  const rows = await db.all<{
    doc_id: string;
    chunk_id: string;
    filename: string;
    path: string;
    score: number;
    snippet: string;
  }>(
    `SELECT
      d.id AS doc_id,
      c.id AS chunk_id,
      d.filename AS filename,
      d.path AS path,
      bm25(f.doc_chunks_fts) AS score,
      snippet(doc_chunks_fts, 2, '<mark>', '</mark>', '…', 32) AS snippet
    FROM doc_chunks_fts f
    JOIN doc_chunks c ON c.id = f.chunk_id
    JOIN doc_metadata d ON d.id = f.doc_id
    WHERE doc_chunks_fts MATCH ?
    ORDER BY score
    LIMIT ?`,
    ftsQuery,
    topK
  );

  const results: SearchResult[] = [];
  for (const r of rows) {
    const highlights = r.snippet ? extractHighlights(r.snippet) : [];
    results.push({
      docId: r.doc_id,
      chunkId: r.chunk_id,
      title: r.filename,
      path: r.path,
      score: normalizeScore(r.score),
      snippet: stripTags(r.snippet),
      highlights,
    });
  }
  return results;
}

function extractHighlights(text: string): string[] {
  const re = /<mark>([^<]*)<\/mark>/g;
  const out: string[] = [];
  let m;
  while ((m = re.exec(text)) !== null) out.push(m[1]);
  return out;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '');
}

function normalizeScore(score: number): number {
  if (score >= 0) return 0;
  return Math.min(1, 1 + score / 100);
}
