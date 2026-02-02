#!/usr/bin/env node
/**
 * Prestart guard: blocks `npm run start` if Next.js build artifacts are missing.
 * Prevents ENOENT on middleware-manifest.json when .next was cleaned without rebuild.
 *
 * Skip: SKIP_PRESTART_CHECK=1 (e.g. Docker image already contains build)
 */
import fs from 'node:fs';
import path from 'node:path';

function exists(p) {
  try {
    fs.accessSync(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function isTruthy(v) {
  return v === '1' || v === 'true' || v === 'yes';
}

const SKIP = isTruthy(process.env.SKIP_PRESTART_CHECK);
if (SKIP) process.exit(0);

const root = process.cwd();

const buildId = path.join(root, '.next', 'BUILD_ID');
const routesManifest = path.join(root, '.next', 'routes-manifest.json');
const serverDir = path.join(root, '.next', 'server');

const missing = [];
if (!exists(buildId)) missing.push('.next/BUILD_ID');
if (!exists(routesManifest)) missing.push('.next/routes-manifest.json');
if (!exists(serverDir)) missing.push('.next/server/');

if (missing.length > 0) {
  console.error('ERROR: Next.js production artifacts are missing:');
  for (const m of missing) console.error(`  - ${m}`);

  console.error('');
  console.error('Fix:');
  console.error('  1) npm run build');
  console.error('  2) npm run start');
  console.error('');
  console.error(
    'If this environment intentionally runs without local .next (e.g. Docker image already contains build),'
  );
  console.error('set SKIP_PRESTART_CHECK=1 for that run.');

  process.exit(1);
}
