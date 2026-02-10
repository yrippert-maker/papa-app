#!/usr/bin/env node
/**
 * db:immutable:on — делает папку БАЗА immutable (chflags uchg).
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
console.log('[immutable] Enabling uchg on:', baseDir);

try {
  execSync(`chflags -R uchg "${baseDir}"`, { stdio: 'inherit', env: { ...process.env } });
  console.log('[immutable] OK: Base is now immutable');
} catch (e) {
  console.error('[immutable] Run with sudo: sudo node scripts/immutable-enable.mjs');
  process.exit(1);
}
