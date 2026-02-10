#!/usr/bin/env node
/**
 * Mac Mirror Sync + Verify
 *
 * Синхронизирует данные из облака (S3) на Mac и проверяет целостность.
 * Read-only: publish/confirm anchoring — только в облаке.
 *
 * Usage:
 *   node scripts/mac-mirror-sync.mjs [--sync-only | --verify-only]
 *   MIRROR_S3_BUCKET=my-bucket MIRROR_LOCAL_DIR=./mirror node scripts/mac-mirror-sync.mjs
 *
 * Env:
 *   MIRROR_S3_BUCKET   — S3 bucket (docs/ledger)
 *   MIRROR_LOCAL_DIR   — локальная папка (default: ./mirror)
 *   AWS_REGION         — регион (default: us-east-1)
 *
 * Exit: 0 = OK, 1 = error
 */
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const BUCKET = process.env.MIRROR_S3_BUCKET || process.env.DOCS_BUCKET || process.env.LEDGER_BUCKET || '';
const LOCAL_DIR = process.env.MIRROR_LOCAL_DIR || join(ROOT, 'mirror');
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

function log(msg) {
  console.log(`[mac-mirror] ${msg}`);
}

function sha256File(path) {
  const buf = readFileSync(path);
  return createHash('sha256').update(buf).digest('hex');
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (r.status !== 0 && !opts.allowFail) {
    throw new Error(`${cmd} ${args.join(' ')} failed: ${r.status}`);
  }
  return r;
}

function syncFromS3() {
  if (!BUCKET) {
    log('MIRROR_S3_BUCKET not set — skip sync');
    return;
  }
  if (!existsSync(LOCAL_DIR)) {
    mkdirSync(LOCAL_DIR, { recursive: true });
  }
  log(`Syncing s3://${BUCKET} -> ${LOCAL_DIR}`);
  run('aws', ['s3', 'sync', `s3://${BUCKET}`, LOCAL_DIR, '--region', AWS_REGION, '--no-progress']);
  log('Sync done');
}

function verifyIntegrity() {
  if (!existsSync(LOCAL_DIR)) {
    log('No mirror dir — run sync first');
    return;
  }
  let ok = 0;
  let fail = 0;

  const checks = [
    ['anchor-receipts', 'anchor receipts'],
    ['ledger', 'ledger'],
    ['audit-snapshots', 'audit snapshots'],
    ['00_SYSTEM/anchor-receipts', 'anchor receipts (00_SYSTEM)'],
  ];
  for (const [subdir, label] of checks) {
    const d = join(LOCAL_DIR, subdir);
    if (existsSync(d)) {
      log(`Verify ${label}:`);
      const entries = readdirSync(d, { withFileTypes: true });
      for (const e of entries) {
        if (!e.isFile()) continue;
        const p = join(d, e.name);
        try {
          const h = sha256File(p);
          log(`  ${subdir}/${e.name} sha256=${h.slice(0, 16)}...`);
          ok++;
        } catch (err) {
          log(`  ${subdir}/${e.name} FAIL: ${err.message}`);
          fail++;
        }
      }
    }
  }

  if (ok === 0 && fail === 0) {
    log('No files to verify (empty mirror or different layout)');
    return;
  }
  if (fail > 0) {
    log(`Verify: ${ok} OK, ${fail} FAIL`);
    process.exit(1);
  }
  log(`Verify: ${ok} files OK`);
}

async function main() {
  const syncOnly = process.argv.includes('--sync-only');
  const verifyOnly = process.argv.includes('--verify-only');

  if (verifyOnly) {
    verifyIntegrity();
    return;
  }
  syncFromS3();
  if (!syncOnly) {
    verifyIntegrity();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
