#!/usr/bin/env node
/**
 * smoke:agent:index — проверка FTS5 индекса (TV3-117 → 2 chunks).
 * Использует WORKSPACE_ROOT для пути к БД.
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { existsSync } from 'node:fs';

const root = process.cwd();
const workspaceRoot = process.env.WORKSPACE_ROOT?.trim() || path.join(root, 'data');
const dbPath = path.join(workspaceRoot, '00_SYSTEM', 'db', 'papa.sqlite');

if (!existsSync(dbPath)) {
  console.error('[smoke:agent:index] FAIL: Database not found. Run: npm run migrate');
  process.exit(1);
}

try {
  const out = execSync(
    `sqlite3 "${dbPath}" "SELECT COUNT(*) FROM doc_chunks_fts WHERE doc_chunks_fts MATCH '\\\"TV3-117\\\"';"`,
    { encoding: 'utf-8' }
  );
  const count = parseInt(out.trim(), 10);
  if (count === 2) {
    console.log('OK agent index: TV3-117 returns 2 chunks');
  } else {
    console.error(`[smoke:agent:index] FAIL: Expected 2 chunks, got ${count}. Run: npm run docs:index:agent:seed`);
    process.exit(1);
  }
} catch (e) {
  console.error('[smoke:agent:index] FAIL:', e?.message || e);
  process.exit(1);
}
