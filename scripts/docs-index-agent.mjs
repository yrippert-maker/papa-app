#!/usr/bin/env node
/**
 * docs:index:agent — индексирует документы для AI Agent (SQLite FTS5).
 * Запускать после migrate.
 *
 * Каноничная схема:
 *   PAPA_DB_ROOT=.../БАЗА/menasa
 *   PAPA_DOC_SOURCES=руководства,документы
 *   PAPA_PRODUCTS=ТВ3-117,АИ-9,НР-3,КД  (опционально)
 *
 * Legacy: DOCS_ROOT_DIR=/path/to/folder
 */
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readdirSync, statSync, readFileSync } from 'fs';
import { createHash, randomUUID } from 'crypto';
import Database from 'better-sqlite3';
import JSZip from 'jszip';
import { getDocsRoot, getDocsRootsForIndex } from './docs-agent-config.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = join(__dirname, '..');
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || join(root, 'data');
const DB_PATH = join(WORKSPACE_ROOT, '00_SYSTEM', 'db', 'papa.sqlite');

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;
const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2MB
const SKIP_PDF = process.env.DOCS_AGENT_SKIP_PDF !== '0'; // PDF по умолчанию пропускаем (pdf-parse тяжёлый)
const SUPPORTED_EXT = new Set(SKIP_PDF ? ['.txt', '.md', '.docx'] : ['.txt', '.md', '.pdf', '.docx']);

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

function chunkText(text) {
  const chunks = [];
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

async function extractPdfText(buffer) {
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

async function extractDocxText(buffer) {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const docXml = zip.file('word/document.xml');
    if (!docXml) return '';
    const xml = await docXml.async('string');
    const matches = xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g);
    return [...matches].map((m) => m[1]).join('');
  } catch {
    return '';
  }
}

function extractText(filePath, ext, buffer) {
  if (ext === '.pdf') return extractPdfText(buffer);
  if (ext === '.docx') return extractDocxText(buffer);
  return Promise.resolve(buffer.toString('utf-8'));
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'app', 'dist', '.next', '__tests__', 'services', 'apps']);

function* walkDir(dirRoot, base = '') {
  const dir = resolve(dirRoot, base);
  if (!existsSync(dir)) return;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const rel = base ? `${base}/${e.name}` : e.name;
    const full = resolve(dirRoot, rel);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      yield* walkDir(dirRoot, rel);
    } else if (e.isFile()) {
      const ext = (e.name.match(/\.[^.]+$/) ?? [''])[0].toLowerCase();
      if (SUPPORTED_EXT.has(ext)) yield { relPath: rel, fullPath: full };
    }
  }
}

/** Обход всех источников (PAPA_* или DOCS_ROOT_DIR). */
function* walkAllFiles() {
  const roots = getDocsRootsForIndex();
  for (const { root, relPrefix } of roots) {
    for (const { relPath, fullPath } of walkDir(root)) {
      yield { relPath: relPrefix + relPath, fullPath };
    }
  }
}

async function main() {
  const docsRoot = getDocsRoot();
  if (!existsSync(docsRoot)) {
    console.error('Docs root does not exist:', docsRoot);
    console.error('Set PAPA_DB_ROOT or DOCS_ROOT_DIR in .env.local');
    process.exit(1);
  }

  if (!existsSync(DB_PATH)) {
    console.error('Database not found. Run: npm run migrate');
    process.exit(1);
  }

  const db = new Database(DB_PATH);
  const run = (sql, ...params) => db.prepare(sql).run(...params);
  const exec = (sql) => db.exec(sql);

  let indexed = 0;
  let totalChunks = 0;
  const errors = [];

  exec('BEGIN');
  try {
    exec('DELETE FROM doc_chunks_fts');
    exec('DELETE FROM doc_chunks');
    exec('DELETE FROM doc_metadata');

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
        run(
          `INSERT INTO doc_metadata (id, path, filename, size, mtime, sha256, ext) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          docId,
          relPath,
          filename,
          stat.size,
          new Date(stat.mtime).toISOString(),
          fileSha,
          ext
        );
        indexed++;

        const chunks = chunkText(text);
        for (let i = 0; i < chunks.length; i++) {
          const chunkId = randomUUID();
          run(`INSERT INTO doc_chunks (id, doc_id, chunk_index, text) VALUES (?, ?, ?, ?)`, chunkId, docId, i, chunks[i]);
          run(`INSERT INTO doc_chunks_fts (chunk_id, doc_id, text) VALUES (?, ?, ?)`, chunkId, docId, chunks[i]);
          totalChunks++;
        }
      } catch (e) {
        errors.push(`${relPath}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    exec('COMMIT');
  } catch (e) {
    exec('ROLLBACK');
    console.error(e);
    process.exit(1);
  }
  db.close();

  console.log('Indexed:', indexed, 'documents,', totalChunks, 'chunks');
  if (errors.length) {
    console.warn('Errors:', errors.length);
    errors.slice(0, 5).forEach((e) => console.warn('  ', e));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
