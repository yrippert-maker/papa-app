#!/usr/bin/env node
/**
 * Migration 005: Add value, unit to inspection_check_result.
 * v0.1.12: check_results value/unit support
 */
import Database from 'better-sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = join(__dirname, '..');
const dbPath = process.env.DB_PATH || join(process.env.WORKSPACE_ROOT || join(root, 'data'), '00_SYSTEM/db/papa.sqlite');

const db = new Database(dbPath);

const tableExists = db.prepare(
  "SELECT 1 FROM sqlite_master WHERE type='table' AND name='inspection_check_result'"
).get();
if (!tableExists) {
  db.close();
  process.exit(0);
}

const cols = db.prepare('PRAGMA table_info(inspection_check_result)').all();
const hasValue = cols.some((c) => c.name === 'value');
const hasUnit = cols.some((c) => c.name === 'unit');

if (!hasValue) {
  db.exec('ALTER TABLE inspection_check_result ADD COLUMN value TEXT');
}
if (!hasUnit) {
  db.exec('ALTER TABLE inspection_check_result ADD COLUMN unit TEXT');
}

db.close();
