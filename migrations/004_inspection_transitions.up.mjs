#!/usr/bin/env node
/**
 * Migration 004: Add transitioned_by, transitioned_at to inspection_card.
 * v0.1.10: Inspection MANAGE
 * Skips if inspection_card does not exist (fresh DB: created by workspace init with full schema).
 */
import Database from 'better-sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = join(__dirname, '..');
const dbPath = process.env.DB_PATH || join(process.env.WORKSPACE_ROOT || join(root, 'data'), '00_SYSTEM/db/papa.sqlite');

const db = new Database(dbPath);

const tableExists = db.prepare(
  "SELECT 1 FROM sqlite_master WHERE type='table' AND name='inspection_card'"
).get();
if (!tableExists) {
  db.close();
  process.exit(0);
}

const cols = db.prepare('PRAGMA table_info(inspection_card)').all();
const hasTransitionedBy = cols.some((c) => c.name === 'transitioned_by');
const hasTransitionedAt = cols.some((c) => c.name === 'transitioned_at');

if (!hasTransitionedBy) {
  db.exec('ALTER TABLE inspection_card ADD COLUMN transitioned_by TEXT');
}
if (!hasTransitionedAt) {
  db.exec('ALTER TABLE inspection_card ADD COLUMN transitioned_at TEXT');
}

db.close();
