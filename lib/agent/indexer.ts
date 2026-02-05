/**
 * AI Agent: индексация документов в Postgres + pgvector.
 * Требует DATABASE_URL. Пути: PAPA_DB_ROOT + PAPA_DOC_SOURCES или DOCS_ROOT_DIR.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import fg from 'fast-glob';
import pLimit from 'p-limit';
import JSZip from 'jszip';
import { getAgentDb } from './db';
import { embed } from './embed';
import pgvector from 'pgvector/pg';
import { getDocsRoot, getDocsRootsForIndex } from '@/lib/docs-agent-config';
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB
const CHUNK_SIZE = 1000;
const SKIP_PDF = process.env.DOCS_AGENT_SKIP_PDF !== '0';

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
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

async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    return (result?.text ?? '').trim();
  } catch {
    return '';
  }
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const docXml = zip.file('word/document.xml');
    if (!docXml) return '';
    const xml = await docXml.async('string');
    const matches = xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g);
    return Array.from(matches, (m) => m[1]).join('');
  } catch {
    return '';
  }
}

async function extractText(filePath: string, buf: Buffer): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') return extractPdfText(buf);
  if (ext === '.docx') return extractDocxText(buf);
  return buf.toString('utf8').trim();
}

export async function indexDocs(): Promise<{ indexed: number; chunks: number; errors: string[] }> {
  const docsRoot = getDocsRoot();
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for agent index');

  const patterns = ['**/*.txt', '**/*.md', '**/*.docx'];
  if (!SKIP_PDF) patterns.push('**/*.pdf');

  const roots = getDocsRootsForIndex();
  const files: { filePath: string; relPath: string }[] = [];
  for (const { root, relPrefix } of roots) {
    const found = await fg(patterns, { cwd: root, absolute: true });
    for (const fp of found) {
      const rel = path.relative(root, fp);
      files.push({ filePath: fp, relPath: relPrefix + rel });
    }
  }

  const limit = pLimit(4);
  const errors: string[] = [];
  let indexed = 0;
  let totalChunks = 0;

  const pool = await getAgentDb();

  for (const { filePath, relPath: relPathForDb } of files) {
    await limit(async () => {
      try {
        const stat = await fs.stat(filePath);
        if (stat.size > MAX_FILE_BYTES) {
          errors.push(`${relPathForDb}: skipped (size > ${MAX_FILE_BYTES})`);
          return;
        }
        const buf = await fs.readFile(filePath);
        const fileSha = sha256(buf);
        const text = await extractText(filePath, buf);
        if (!text.trim()) return;

        const relPath = relPathForDb;
        const ext = path.extname(filePath).toLowerCase();
        const filename = path.basename(filePath);

        const chunks = chunkText(text);
        const vectors = await embed(chunks);

        const client = await pool.connect();
        try {
          const docRes = await client.query(
            `INSERT INTO agent_docs (path, filename, ext, sha256, size_bytes, modified_at, extracted_text)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (path) DO UPDATE SET
               sha256 = EXCLUDED.sha256,
               size_bytes = EXCLUDED.size_bytes,
               modified_at = EXCLUDED.modified_at,
               extracted_text = EXCLUDED.extracted_text,
               updated_at = now()
             RETURNING id`,
            [relPath, filename, ext, fileSha, stat.size, stat.mtime, text]
          );
          const docId = docRes.rows[0]!.id;

          await client.query('DELETE FROM agent_doc_chunks WHERE doc_id = $1', [docId]);

          for (let i = 0; i < chunks.length; i++) {
            const vecSql = pgvector.toSql(vectors[i]!);
            await client.query(
              `INSERT INTO agent_doc_chunks (doc_id, idx, content, embedding) VALUES ($1, $2, $3, $4::vector)`,
              [docId, i, chunks[i], vecSql]
            );
            totalChunks++;
          }
          indexed++;
        } finally {
          client.release();
        }
      } catch (e) {
        errors.push(`${filePath}: ${e instanceof Error ? e.message : String(e)}`);
      }
    });
  }

  return { indexed, chunks: totalChunks, errors };
}
