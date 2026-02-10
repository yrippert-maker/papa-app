#!/usr/bin/env npx tsx
/**
 * agent:ingest:worker — воркер очереди индексации документов.
 * Берёт jobs из agent_ingest_jobs, создаёт чанки и эмбеддинги.
 * Требует: DATABASE_URL
 */
import 'dotenv/config';
import { getAgentDb } from '../lib/agent/db';
import { embed } from '../lib/agent/embed';
import pgvector from 'pgvector/pg';
import { getDocsRootForPath } from '../lib/docs-agent-config';
import fs from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';

const CHUNK_SIZE = 1000;
const POLL_MS = 1000;

async function claimJob(pool: Awaited<ReturnType<typeof getAgentDb>>) {
  const r = await pool.query(`
    WITH j AS (
      SELECT id
      FROM agent_ingest_jobs
      WHERE status = 'queued'
        AND attempts < 3
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE agent_ingest_jobs
    SET status = 'running',
        attempts = attempts + 1,
        updated_at = now()
    WHERE id IN (SELECT id FROM j)
    RETURNING id, doc_id, attempts
  `);
  return r.rows[0] ?? null;
}

async function markDone(pool: Awaited<ReturnType<typeof getAgentDb>>, jobId: string) {
  await pool.query(
    `UPDATE agent_ingest_jobs SET status = 'done', last_error = NULL WHERE id = $1`,
    [jobId]
  );
}

function formatJobError(code: string, err: unknown): string {
  const msg = err instanceof Error ? (err.message || String(err)) : String(err);
  return `[${code}] ${msg}`;
}

async function markError(
  pool: Awaited<ReturnType<typeof getAgentDb>>,
  jobId: string,
  code: string,
  err: unknown
) {
  const lastError = formatJobError(code, err);
  await pool.query(
    `UPDATE agent_ingest_jobs SET status = 'error', last_error = $2 WHERE id = $1`,
    [jobId, lastError]
  );
}

async function extractTextFromFile(filePath: string, buf: Buffer): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') {
    try {
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: buf });
      const result = await parser.getText();
      await parser.destroy();
      return (result?.text ?? '').trim();
    } catch {
      return '';
    }
  }
  if (ext === '.docx') {
    try {
      const zip = await JSZip.loadAsync(buf);
      const docXml = zip.file('word/document.xml');
      if (!docXml) return '';
      const xml = await docXml.async('string');
      const matches = xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g);
      return Array.from(matches, (m) => m[1]).join('');
    } catch {
      return '';
    }
  }
  return buf.toString('utf8').trim();
}

function chunkText(text: string, maxLen = CHUNK_SIZE): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const chunks: string[] = [];
  for (let i = 0; i < clean.length; i += maxLen) {
    chunks.push(clean.slice(i, i + maxLen));
  }
  return chunks;
}

async function ingestDoc(
  pool: Awaited<ReturnType<typeof getAgentDb>>,
  docId: string
): Promise<void> {
  const docRes = await pool.query(
    `SELECT d.path, d.extracted_text,
            (SELECT content_text FROM agent_doc_override WHERE doc_id = d.id) AS override_text
     FROM agent_docs d WHERE d.id = $1`,
    [docId]
  );
  const doc = docRes.rows[0];
  if (!doc) throw new Error(`Doc ${docId} not found`);

  let text = String(doc.override_text ?? doc.extracted_text ?? '').trim();
  if (!text) {
    const docsRoot = getDocsRootForPath(doc.path as string);
    const fullPath = path.join(docsRoot, doc.path as string);
    let buf: Buffer;
    try {
      buf = await fs.readFile(fullPath);
    } catch (e) {
      throw new Error(formatJobError('READ_FAIL', e));
    }
    text = await extractTextFromFile(doc.path as string, buf);
    if (text) {
      await pool.query(
        `UPDATE agent_docs SET extracted_text = $2, updated_at = now() WHERE id = $1`,
        [docId, text]
      );
    }
  }
  if (!text) {
    throw new Error(formatJobError('EXTRACT_EMPTY', new Error(`No text to index. path=${doc.path}`)));
  }

  const chunks = chunkText(text);
  let vectors: number[][];
  try {
    vectors = await embed(chunks);
  } catch (e) {
    throw new Error(formatJobError('EMBED_FAIL', e));
  }

  await pool.query(`DELETE FROM agent_doc_chunks WHERE doc_id = $1`, [docId]);

  try {
    for (let i = 0; i < chunks.length; i++) {
      const vecSql = pgvector.toSql(vectors[i]!);
      await pool.query(
        `INSERT INTO agent_doc_chunks (doc_id, idx, content, embedding) VALUES ($1, $2, $3, $4::vector)`,
        [docId, i, chunks[i], vecSql]
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('dimension') || msg.includes('vector')) {
      throw new Error(formatJobError('VECTOR_DIM_MISMATCH', e));
    }
    throw e;
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL required');
    process.exit(1);
  }

  const pool = await getAgentDb();
  console.log('[agent-ingest-worker] Started, polling every', POLL_MS, 'ms');

  for (;;) {
    const job = await claimJob(pool);
    if (!job) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      continue;
    }

    const jobId = (job as { id: string }).id;
    const docId = (job as { doc_id: string }).doc_id;

    try {
      await ingestDoc(pool, docId);
      await markDone(pool, jobId);
      console.log('[agent-ingest-worker] Done:', docId);
    } catch (e) {
      const code =
        (e instanceof Error && e.message.startsWith('[READ_FAIL]')) ? 'READ_FAIL' :
        (e instanceof Error && e.message.startsWith('[EXTRACT_EMPTY]')) ? 'EXTRACT_EMPTY' :
        (e instanceof Error && e.message.startsWith('[EMBED_FAIL]')) ? 'EMBED_FAIL' :
        (e instanceof Error && e.message.startsWith('[VECTOR_DIM_MISMATCH]')) ? 'VECTOR_DIM_MISMATCH' :
        'UNKNOWN';
      await markError(pool, jobId, code, e);
      console.error('[agent-ingest-worker] Error:', docId, e);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
