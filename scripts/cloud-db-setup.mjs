#!/usr/bin/env node
/**
 * cloud-db-setup — проверка облачной БД и прогон миграций.
 * Читает DATABASE_URL из process.env или .env.
 *
 * Использование:
 *   DATABASE_URL=postgresql://... npm run cloud:setup
 *   npm run cloud:setup   # если DATABASE_URL в .env
 */
import pg from 'pg';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = join(__dirname, '..');

function loadEnv() {
  const envPath = join(root, '.env');
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) {
        const key = m[1].trim();
        const val = m[2].trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}

loadEnv();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required. Set in .env or: DATABASE_URL=... npm run cloud:setup');
  process.exit(1);
}

if (url.includes('localhost') && !process.env.CLOUD_SETUP_FORCE) {
  console.warn('Warning: DATABASE_URL points to localhost. For cloud setup use Supabase/RDS URL.');
  console.warn('Override with CLOUD_SETUP_FORCE=1 to continue.');
  process.exit(1);
}

async function main() {
  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
    console.log('Connected to database');

    const ext = await client.query("SELECT 1 FROM pg_extension WHERE extname = 'vector'");
    if (ext.rows.length === 0) {
      console.log('Enabling pgvector extension...');
      await client.query('CREATE EXTENSION IF NOT EXISTS vector');
      console.log('pgvector enabled');
    } else {
      console.log('pgvector already enabled');
    }

    await client.end();
  } catch (e) {
    console.error('Connection failed:', e.message);
    process.exit(1);
  }

  console.log('\nRunning migrations...');
  const { spawn } = await import('child_process');
  const proc = spawn('node', [join(__dirname, 'db-pg-migrate.mjs')], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
  proc.on('exit', (code) => process.exit(code ?? 0));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
