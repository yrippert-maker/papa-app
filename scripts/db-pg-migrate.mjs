#!/usr/bin/env node
/**
 * Postgres migration runner (вне-Prisma таблицы).
 * Использует DATABASE_URL, прогоняет SQL из db/migrations/postgres/*.sql по порядку имени.
 * Таблица _pg_migrations хранит применённые версии.
 *
 * Использование:
 *   DATABASE_URL=postgresql://... npm run db:pg:migrate
 */
import pg from 'pg';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = join(__dirname, '..');
const migrationsDir = join(root, 'db', 'migrations', 'postgres');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required for db:pg:migrate');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });

async function ensureMigrationsTable() {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _pg_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

function getMigrationFiles() {
  if (!existsSync(migrationsDir)) return [];
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  return files;
}

async function getApplied() {
  const r = await client.query('SELECT version FROM _pg_migrations ORDER BY version');
  return new Set(r.rows.map((row) => row.version));
}

async function run() {
  await client.connect();
  await ensureMigrationsTable();
  const applied = await getApplied();
  const files = getMigrationFiles();

  for (const file of files) {
    const version = file.replace(/\.sql$/, '');
    if (applied.has(version)) {
      console.log('Skip (already applied):', version);
      continue;
    }
    const path = join(migrationsDir, file);
    const sql = readFileSync(path, 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO _pg_migrations (version) VALUES ($1)', [version]);
      await client.query('COMMIT');
      console.log('Applied:', version);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Migration failed:', version, err.message);
      process.exit(1);
    }
  }

  await client.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
