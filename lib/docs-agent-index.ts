/**
 * AI Agent: индексация документов (txt, md, pdf, docx).
 * Использует PAPA_DB_ROOT + PAPA_DOC_SOURCES или DOCS_ROOT_DIR.
 */
import { createHash } from 'crypto';
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { randomUUID } from 'crypto';
import { getDocsRoot, getDocsRootsForIndex } from './docs-agent-config';

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB — большие PDF могут вызвать OOM
const SUPPORTED_EXT = new Set(['.txt', '.md', '.pdf', '.docx']);

export type DocMetadata = {
  id: string;
  path: string;
  filename: string;
  size: number;
  mtime: string;
  sha256: string;
  ext: string;
};

export type DocChunk = {
  id: string;
  doc_id: string;
  chunk_index: number;
  text: string;
};

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  const len = text.length;
  if (len === 0) return [];
  while (start < len) {
    let end = Math.min(start + CHUNK_SIZE, len);
    if (end < len) {
      const lastSpace = text.lastIndexOf(' ', end);
      if (lastSpace > start + CHUNK_SIZE / 2) end = lastSpace + 1;
    }
    chunks.push(text.slice(start, end).trim());
    start = end - CHUNK_OVERLAP;
    if (start >= len) break;
  }
  return chunks.filter((c) => c.length > 0);
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    return result?.text ?? '';
  } catch {
    return '';
  }
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  try {
    const JSZip = (await import('jszip')).default;
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

function extractText(filePath: string, ext: string, buffer: Buffer): Promise<string> {
  if (ext === '.pdf') return extractPdfText(buffer);
  if (ext === '.docx') return extractDocxText(buffer);
  return Promise.resolve(buffer.toString('utf-8'));
}

function* walkDir(root: string, base = ''): Generator<{ relPath: string; fullPath: string }> {
  const dir = resolve(root, base);
  if (!existsSync(dir)) return;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const rel = base ? `${base}/${e.name}` : e.name;
    const full = resolve(root, rel);
    if (e.isDirectory()) {
      yield* walkDir(root, rel);
    } else if (e.isFile()) {
      const ext = (e.name.match(/\.[^.]+$/) ?? [''])[0].toLowerCase();
      if (SUPPORTED_EXT.has(ext)) yield { relPath: rel, fullPath: full };
    }
  }
}

function* walkAllFiles(): Generator<{ relPath: string; fullPath: string }> {
  const roots = getDocsRootsForIndex();
  for (const { root, relPrefix } of roots) {
    for (const { relPath, fullPath } of walkDir(root)) {
      yield { relPath: relPrefix + relPath, fullPath };
    }
  }
}

export type IndexDb = {
  exec: (sql: string) => void | Promise<void>;
  run: (sql: string, ...params: unknown[]) => void | Promise<unknown>;
};

async function execSql(db: IndexDb, sql: string): Promise<void> {
  const r = db.exec(sql);
  if (r && typeof (r as Promise<unknown>).then === 'function') await (r as Promise<void>);
}

export async function indexDocuments(db: IndexDb): Promise<{ indexed: number; chunks: number; errors: string[] }> {
  const docsRoot = getDocsRoot();
  const errors: string[] = [];
  let indexed = 0;
  let totalChunks = 0;

  await execSql(db, 'BEGIN');
  try {
    await execSql(db, 'DELETE FROM doc_chunks_fts');
    await execSql(db, 'DELETE FROM doc_chunks');
    await execSql(db, 'DELETE FROM doc_metadata');

    for (const { relPath, fullPath } of walkAllFiles()) {
      try {
        const stat = statSync(fullPath);
        if (stat.size > MAX_FILE_BYTES) {
          errors.push(`${relPath}: skipped (size ${stat.size} > ${MAX_FILE_BYTES})`);
          continue;
        }
        const buffer = readFileSync(fullPath);
        const fileSha = sha256(buffer);
        const ext = (relPath.match(/\.[^.]+$/) ?? [''])[0].toLowerCase();
        const filename = relPath.split('/').pop() ?? relPath;

        const text = await extractText(fullPath, ext, buffer);
        if (!text.trim()) continue;

        const docId = randomUUID();
        const runResult = db.run(
          `INSERT INTO doc_metadata (id, path, filename, size, mtime, sha256, ext) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          docId,
          relPath,
          filename,
          stat.size,
          new Date(stat.mtime).toISOString(),
          fileSha,
          ext
        );
        if (runResult && typeof (runResult as Promise<unknown>).then === 'function') await runResult;
        indexed++;

        const chunks = chunkText(text);
        for (let i = 0; i < chunks.length; i++) {
          const chunkId = randomUUID();
          const r1 = db.run(
            `INSERT INTO doc_chunks (id, doc_id, chunk_index, text) VALUES (?, ?, ?, ?)`,
            chunkId,
            docId,
            i,
            chunks[i]
          );
          if (r1 && typeof (r1 as Promise<unknown>).then === 'function') await r1;
          const r2 = db.run(
            `INSERT INTO doc_chunks_fts (chunk_id, doc_id, text) VALUES (?, ?, ?)`,
            chunkId,
            docId,
            chunks[i]
          );
          if (r2 && typeof (r2 as Promise<unknown>).then === 'function') await r2;
          totalChunks++;
        }
      } catch (e) {
        errors.push(`${relPath}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    await execSql(db, 'COMMIT');
  } catch (e) {
    await execSql(db, 'ROLLBACK');
    throw e;
  }

  return { indexed, chunks: totalChunks, errors };
}
