#!/usr/bin/env node
/**
 * db:immutable:off — снимает immutable с папки БАЗА (chflags nouchg).
 * Требует sudo. PAPA_DB_ROOT из .env.local или env.
 */
import dotenv from 'dotenv';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { existsSync } from 'node:fs';

const envLocal = path.join(process.cwd(), '.env.local');
if (existsSync(envLocal)) dotenv.config({ path: envLocal });
dotenv.config();

const papaRoot = process.env.PAPA_DB_ROOT?.trim();
if (!papaRoot) {
  console.error('[immutable] PAPA_DB_ROOT is not set');
  process.exit(1);
}

const baseDir = path.dirname(path.resolve(papaRoot)); // .../БАЗА
console.log('[immutable] Disabling uchg on:', baseDir);

try {
  execSync(`chflags -R nouchg "${baseDir}"`, { stdio: 'inherit', env: { ...process.env } });
  console.log('[immutable] OK: Base is no longer immutable');
} catch (e) {
  console.error('[immutable] Run with sudo: sudo node scripts/immutable-disable.mjs');
  process.exit(1);
}
