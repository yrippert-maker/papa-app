#!/usr/bin/env node
/**
 * Publish ledger-entry.json to S3 or GCS (append-only evidence ledger).
 * Optionally upload pack archive to PACKS_BUCKET and add pack_object to the entry.
 *
 * Usage:
 *   node scripts/ledger-publish.mjs --pack <packDir> --backend s3 --bucket <bucket> [--prefix <prefix>]
 *   node scripts/ledger-publish.mjs --pack <packDir> --backend gcs --bucket <bucket> [--prefix <prefix>]
 *
 * Env: LEDGER_BACKEND, LEDGER_BUCKET, LEDGER_PREFIX=ledger, LEDGER_WRITE_INDEX=1 (optional)
 *      PACKS_BUCKET, PACKS_PREFIX=packs (optional; uploads pack tar.gz and adds pack_object to entry)
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

function usage() {
  console.error(
    [
      'Usage:',
      '  node scripts/ledger-publish.mjs --pack <packDir> --backend s3 --bucket <bucket> [--prefix <prefix>]',
      '  node scripts/ledger-publish.mjs --pack <packDir> --backend gcs --bucket <bucket> [--prefix <prefix>]',
      '',
      'Env: LEDGER_BACKEND, LEDGER_BUCKET, LEDGER_PREFIX=ledger, LEDGER_WRITE_INDEX=1',
      '     PACKS_BUCKET, PACKS_PREFIX=packs (optional; upload pack tar.gz and add pack_object to entry)',
    ].join('\n')
  );
  process.exit(1);
}

function argVal(flag) {
  const i = process.argv.indexOf(flag);
  if (i === -1) return null;
  return process.argv[i + 1] || null;
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    stdio: opts.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...(opts.env || {}) },
  });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    const out = (r.stdout || Buffer.from('')).toString('utf8');
    const err = (r.stderr || Buffer.from('')).toString('utf8');
    throw new Error(`Command failed: ${cmd} ${args.join(' ')} (exit ${r.status})\n${out}\n${err}`);
  }
  return { stdout: (r.stdout || Buffer.from('')).toString('utf8'), stderr: (r.stderr || Buffer.from('')).toString('utf8') };
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function utcPathParts(iso) {
  const d = iso ? new Date(iso) : new Date();
  return {
    yyyy: String(d.getUTCFullYear()),
    mm: pad2(d.getUTCMonth() + 1),
    dd: pad2(d.getUTCDate()),
  };
}

async function main() {
  const packDir = argVal('--pack');
  const backend = (argVal('--backend') || process.env.LEDGER_BACKEND || '').trim();
  const bucket = (argVal('--bucket') || process.env.LEDGER_BUCKET || '').trim();
  const prefix = (argVal('--prefix') || process.env.LEDGER_PREFIX || 'ledger').replace(/^\/+|\/+$/g, '');
  const writeIndex = (process.env.LEDGER_WRITE_INDEX || '') === '1';

  if (!packDir || !backend || !bucket) usage();

  const entryPath = path.join(packDir, 'ledger-entry.json');
  if (!fs.existsSync(entryPath)) {
    console.error(`Missing ${entryPath}. Run independent-verify first.`);
    process.exit(2);
  }

  const entry = JSON.parse(fs.readFileSync(entryPath, 'utf8'));
  const sha = entry?.pack?.sha256 || entry?.fingerprint_sha256 || null;
  if (!sha) {
    console.error('ledger-entry.json missing pack.sha256 and fingerprint_sha256');
    process.exit(2);
  }

  const packsBucket = (argVal('--packs-bucket') || process.env.PACKS_BUCKET || '').trim();
  const packsPrefix = (argVal('--packs-prefix') || process.env.PACKS_PREFIX || 'packs').replace(/^\/+|\/+$/g, '');
  const packExt = (argVal('--pack-ext') || process.env.PACK_ARCHIVE_EXT || 'tar.gz').trim();

  if (packsBucket) {
    const parentDir = path.dirname(packDir);
    const packBasename = path.basename(packDir);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-publish-'));
    const tarPath = path.join(tmpDir, `${sha}.${packExt}`);
    try {
      run('tar', ['-czf', tarPath, '-C', parentDir, packBasename], { capture: true });
      const packObjectKey = `${packsPrefix}/${sha}.${packExt}`;
      console.log(`PACK UPLOAD: backend=${backend} bucket=${packsBucket} key=${packObjectKey}`);
      if (backend === 's3') {
        run('aws', ['s3', 'cp', tarPath, `s3://${packsBucket}/${packObjectKey}`, '--content-type', 'application/gzip']);
      } else if (backend === 'gcs') {
        run('gsutil', ['-h', 'Content-Type:application/gzip', 'cp', tarPath, `gs://${packsBucket}/${packObjectKey}`]);
      }
      entry.pack_object = { bucket: packsBucket, key: packObjectKey, sha256: sha };
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {}
    }
  }

  const parts = utcPathParts(entry.generated_at);
  const objectKey = `${prefix}/${parts.yyyy}/${parts.mm}/${parts.dd}/${sha}.json`;
  const tmpFile = path.join(packDir, `ledger-entry.${sha.slice(0, 16)}.upload.json`);
  fs.writeFileSync(tmpFile, JSON.stringify(entry, null, 2), 'utf8');

  console.log(`LEDGER PUBLISH: backend=${backend} bucket=${bucket} key=${objectKey}`);

  if (backend === 's3') {
    run('aws', ['s3', 'cp', tmpFile, `s3://${bucket}/${objectKey}`, '--content-type', 'application/json']);
    if (writeIndex) {
      const idxKey = `${prefix}/${parts.yyyy}/${parts.mm}/${parts.dd}/index.jsonl`;
      const idxTmp = path.join(packDir, `ledger-index.${parts.yyyy}${parts.mm}${parts.dd}.jsonl`);
      try {
        run('aws', ['s3', 'cp', `s3://${bucket}/${idxKey}`, idxTmp], { capture: true });
      } catch {
        fs.writeFileSync(idxTmp, '', 'utf8');
      }
      fs.appendFileSync(
        idxTmp,
        JSON.stringify({ sha256: sha, key: objectKey, generated_at: entry.generated_at }) + '\n',
        'utf8'
      );
      run('aws', ['s3', 'cp', idxTmp, `s3://${bucket}/${idxKey}`, '--content-type', 'text/plain']);
    }
  } else if (backend === 'gcs') {
    run('gsutil', ['-h', 'Content-Type:application/json', 'cp', tmpFile, `gs://${bucket}/${objectKey}`]);
    if (writeIndex) {
      const idxKey = `${prefix}/${parts.yyyy}/${parts.mm}/${parts.dd}/index.jsonl`;
      const idxTmp = path.join(packDir, `ledger-index.${parts.yyyy}${parts.mm}${parts.dd}.jsonl`);
      try {
        run('gsutil', ['cp', `gs://${bucket}/${idxKey}`, idxTmp], { capture: true });
      } catch {
        fs.writeFileSync(idxTmp, '', 'utf8');
      }
      fs.appendFileSync(
        idxTmp,
        JSON.stringify({ sha256: sha, key: objectKey, generated_at: entry.generated_at }) + '\n',
        'utf8'
      );
      run('gsutil', ['-h', 'Content-Type:text/plain', 'cp', idxTmp, `gs://${bucket}/${idxKey}`]);
    }
  } else {
    console.error(`Unknown backend: ${backend} (expected s3|gcs)`);
    process.exit(2);
  }

  try {
    fs.unlinkSync(tmpFile);
  } catch {}

  console.log('LEDGER PUBLISH: OK');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e?.stack || String(e));
    process.exit(2);
  });
}
