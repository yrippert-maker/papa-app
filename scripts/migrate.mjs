#!/usr/bin/env node
/**
 * Migration runner: up | down
 * node scripts/migrate.mjs up   - применить миграции
 * node scripts/migrate.mjs down - откатить последнюю
 */
import Database from 'better-sqlite3';
import { readFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = join(__dirname, '..');
const dbPath = process.env.DB_PATH || join(process.env.WORKSPACE_ROOT || join(root, 'data'), '00_SYSTEM/db/papa.sqlite');
const migrationsDir = join(root, 'migrations');

const cmd = process.argv[2] || 'up';

const dbDir = dirname(dbPath);
if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });

let db = new Database(dbPath);
db.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

function getMigrations() {
  if (!existsSync(migrationsDir)) return [];
  const files = readdirSync(migrationsDir);
  const names = new Set();
  for (const f of files) {
    if (f.endsWith('.up.sql')) names.add(f.replace('.up.sql', ''));
    if (f.endsWith('.up.mjs')) names.add(f.replace('.up.mjs', ''));
  }
  return [...names].sort();
}

function getApplied() {
  return db.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map((r) => r.version);
}

if (cmd === 'up') {
  const all = getMigrations();
  const applied = new Set(getApplied());
  for (const name of all) {
    if (applied.has(name)) continue;
    const sqlPath = join(migrationsDir, `${name}.up.sql`);
    const mjsPath = join(migrationsDir, `${name}.up.mjs`);
    if (existsSync(mjsPath)) {
      db.close();
      const r = spawnSync(process.execPath, [mjsPath], {
        cwd: root,
        env: { ...process.env, DB_PATH: dbPath, WORKSPACE_ROOT: process.env.WORKSPACE_ROOT || '' },
        stdio: 'inherit',
      });
      if (r.status !== 0) {
        console.error('Migration failed:', name);
        process.exit(1);
      }
      const db2 = new Database(dbPath);
      db2.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(name);
      db2.close();
      // Re-open for next migration
      db = new Database(dbPath);
    } else {
      const sql = readFileSync(sqlPath, 'utf8');
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(name);
    }
    console.log('Applied:', name);
  }
} else if (cmd === 'down') {
  const applied = getApplied();
  if (applied.length === 0) {
    console.log('No migrations to rollback');
    process.exit(0);
  }
  const last = applied[applied.length - 1];
  const downPath = join(migrationsDir, `${last}.down.sql`);
  if (!existsSync(downPath)) {
    console.error('No down migration for', last);
    process.exit(1);
  }
  const sql = readFileSync(downPath, 'utf8');
  db.exec(sql);
  db.prepare('DELETE FROM schema_migrations WHERE version = ?').run(last);
  console.log('Rolled back:', last);
} else {
  console.error('Usage: node migrate.mjs up | down');
  process.exit(1);
}

db.close();
