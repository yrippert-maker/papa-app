/**
 * Очередь индексации: добавление документа в agent_docs + agent_ingest_jobs.
 * Вызывается при загрузке файла (ai-inbox) или при необходимости переиндексации.
 */
import { getAgentDb } from './db';

export type QueueAgentIngestParams = {
  path: string;
  filename: string;
  ext: string;
  sha256: string;
  sizeBytes: number;
  modifiedAt: Date;
  extractedText?: string | null;
};

/**
 * Вставляет/обновляет agent_docs и ставит job в agent_ingest_jobs.
 * Не бросает при ошибке (логирует), чтобы не ломать upload.
 */
export async function queueAgentIngest(params: QueueAgentIngestParams): Promise<string | null> {
  if (!process.env.DATABASE_URL) return null;

  try {
    const pool = await getAgentDb();
    const r = await pool.query(
      `INSERT INTO agent_docs (path, filename, ext, sha256, size_bytes, modified_at, extracted_text)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (path) DO UPDATE SET
         sha256 = EXCLUDED.sha256,
         size_bytes = EXCLUDED.size_bytes,
         modified_at = EXCLUDED.modified_at,
         extracted_text = COALESCE(EXCLUDED.extracted_text, agent_docs.extracted_text),
         updated_at = now()
       RETURNING id`,
      [
        params.path,
        params.filename,
        params.ext,
        params.sha256,
        params.sizeBytes,
        params.modifiedAt,
        params.extractedText ?? null,
      ]
    );
    const docId = r.rows[0]?.id;
    if (!docId) return null;

    try {
      await pool.query(`INSERT INTO agent_ingest_jobs (doc_id) VALUES ($1)`, [docId]);
    } catch (dup: unknown) {
      if ((dup as { code?: string })?.code !== '23505') throw dup;
    }
    return docId;
  } catch (e) {
    console.warn('[agent/ingest-queue]', e);
    return null;
  }
}

/**
 * Поставить существующий документ в очередь (только job, doc уже есть).
 */
export async function enqueueAgentIngestJob(docId: string): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;

  try {
    const pool = await getAgentDb();
    const check = await pool.query('SELECT 1 FROM agent_docs WHERE id = $1', [docId]);
    if (check.rows.length === 0) return false;

    try {
      await pool.query(`INSERT INTO agent_ingest_jobs (doc_id) VALUES ($1)`, [docId]);
    } catch (dup: unknown) {
      if ((dup as { code?: string })?.code !== '23505') throw dup;
    }
    return true;
  } catch (e) {
    console.warn('[agent/ingest-queue]', e);
    return false;
  }
}
