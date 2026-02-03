#!/usr/bin/env node
/**
 * Build daily Merkle rollup over ledger entries (S3/GCS).
 *
 * Usage:
 *   node scripts/ledger-rollup.mjs --backend s3|gcs --bucket <bucket> --date YYYY-MM-DD [--ledger-prefix ledger] [--rollup-prefix ledger-rollups]
 *
 * Env: LEDGER_BACKEND, LEDGER_BUCKET, LEDGER_PREFIX=ledger, DOC_LEDGER_PREFIX=doc-ledger,
 *      LEDGER_ROLLUP_PREFIX=ledger-rollups, LEDGER_ROLLUP_DOWNLOAD_DIR, LEDGER_ROLLUP_MAX_ENTRIES=5000,
 *      LEDGER_ROLLUP_WRITE_ANCHOR_REQUEST=1
 *
 * Daily rollup includes:
 *   - LEDGER_PREFIX/YYYY/MM/DD/*.json (verify, etc.)
 *   - DOC_LEDGER_PREFIX/YYYY/MM/DD/*.json (doc_update, config_change e.g. allowlist)
 *   - MAIL_LEDGER_PREFIX/YYYY/MM/DD/*.json (mail ingestion)
 * One Merkle root / anchoring for all.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function usage() {
  console.error(
    [
      'Usage:',
      '  node scripts/ledger-rollup.mjs --backend s3|gcs --bucket <bucket> --date YYYY-MM-DD [--ledger-prefix ledger] [--doc-ledger-prefix doc-ledger] [--mail-ledger-prefix mail-ledger] [--rollup-prefix ledger-rollups]',
      '',
      'Env:',
      '  LEDGER_BACKEND, LEDGER_BUCKET, LEDGER_PREFIX=ledger, DOC_LEDGER_PREFIX=doc-ledger, MAIL_LEDGER_PREFIX=mail-ledger, LEDGER_ROLLUP_PREFIX=ledger-rollups',
      '  LEDGER_ROLLUP_DOWNLOAD_DIR, LEDGER_ROLLUP_MAX_ENTRIES=5000, LEDGER_ROLLUP_WRITE_ANCHOR_REQUEST=1',
      '  LEDGER_ROLLUP_ANCHOR=1 (optional; run rollup-anchor-publish after upload, requires ANCHOR_* + ANCHORING_PUBLISH_ENABLED)',
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
  return {
    stdout: (r.stdout || Buffer.from('')).toString('utf8'),
    stderr: (r.stderr || Buffer.from('')).toString('utf8'),
  };
}

function sha256Hex(buf) {
  return crypto.createHash('sha256').update(Buffer.isBuffer(buf) ? buf : Buffer.from(String(buf), 'utf8')).digest('hex');
}

function merkleRootHex(leavesHex) {
  if (!leavesHex.length) return sha256Hex(Buffer.from('EMPTY', 'utf8'));
  let level = leavesHex.map((h) => Buffer.from(h, 'hex'));
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] || level[i];
      next.push(crypto.createHash('sha256').update(Buffer.concat([left, right])).digest());
    }
    level = next;
  }
  return level[0].toString('hex');
}

function parseDateParts(yyyy_mm_dd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(yyyy_mm_dd || ''));
  if (!m) throw new Error(`Invalid --date ${yyyy_mm_dd} (expected YYYY-MM-DD)`);
  return { yyyy: m[1], mm: m[2], dd: m[3] };
}

function listLedgerKeysS3(bucket, prefix) {
  const out = run(
    'aws',
    ['s3api', 'list-objects-v2', '--bucket', bucket, '--prefix', prefix, '--query', 'Contents[].Key', '--output', 'json'],
    { capture: true }
  ).stdout;
  try {
    const arr = JSON.parse(out);
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function listLedgerKeysGcs(bucket, prefix) {
  const out = run('gsutil', ['ls', `gs://${bucket}/${prefix}`], { capture: true }).stdout;
  return out
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((u) => u.replace(`gs://${bucket}/`, ''));
}

function downloadObjectS3(bucket, key, dstPath) {
  run('aws', ['s3', 'cp', `s3://${bucket}/${key}`, dstPath, '--quiet']);
}

function downloadObjectGcs(bucket, key, dstPath) {
  run('gsutil', ['cp', '-q', `gs://${bucket}/${key}`, dstPath]);
}

function uploadObjectS3(bucket, key, srcPath, contentType) {
  const args = ['s3', 'cp', srcPath, `s3://${bucket}/${key}`];
  if (contentType) args.push('--content-type', contentType);
  run('aws', args);
}

function uploadObjectGcs(bucket, key, srcPath, contentType) {
  const args = [];
  if (contentType) args.push('-h', `Content-Type:${contentType}`);
  args.push('cp', srcPath, `gs://${bucket}/${key}`);
  run('gsutil', args);
}

async function main() {
  const backend = (argVal('--backend') || process.env.LEDGER_BACKEND || '').trim();
  const bucket = (argVal('--bucket') || process.env.LEDGER_BUCKET || '').trim();
  const dateStr = (argVal('--date') || '').trim();
  const ledgerPrefix = (argVal('--ledger-prefix') || process.env.LEDGER_PREFIX || 'ledger').replace(/^\/+|\/+$/g, '');
  const docLedgerPrefix = (argVal('--doc-ledger-prefix') || process.env.DOC_LEDGER_PREFIX || 'doc-ledger').replace(
    /^\/+|\/+$/g,
    ''
  );
  const mailLedgerPrefix = (argVal('--mail-ledger-prefix') || process.env.MAIL_LEDGER_PREFIX || 'mail-ledger').replace(
    /^\/+|\/+$/g,
    ''
  );
  const rollupPrefix = (argVal('--rollup-prefix') || process.env.LEDGER_ROLLUP_PREFIX || 'ledger-rollups').replace(
    /^\/+|\/+$/g,
    ''
  );
  const dlDir = (process.env.LEDGER_ROLLUP_DOWNLOAD_DIR || path.join(os.tmpdir(), 'ledger-rollup')).trim();
  const maxEntries = Number(process.env.LEDGER_ROLLUP_MAX_ENTRIES || '5000');
  const writeAnchorReq = (process.env.LEDGER_ROLLUP_WRITE_ANCHOR_REQUEST || '') === '1';
  const runAnchorPublish = (process.env.LEDGER_ROLLUP_ANCHOR || '') === '1';

  if (!backend || !bucket || !dateStr) usage();
  const { yyyy, mm, dd } = parseDateParts(dateStr);

  const dayPrefixLedger = `${ledgerPrefix}/${yyyy}/${mm}/${dd}/`;
  const dayPrefixDocLedger = `${docLedgerPrefix}/${yyyy}/${mm}/${dd}/`;
  const dayPrefixMailLedger = `${mailLedgerPrefix}/${yyyy}/${mm}/${dd}/`;
  fs.mkdirSync(dlDir, { recursive: true });

  const listKeys = (prefix) =>
    backend === 's3'
      ? listLedgerKeysS3(bucket, prefix)
      : backend === 'gcs'
        ? listLedgerKeysGcs(bucket, prefix)
        : (() => {
            throw new Error(`Unknown backend: ${backend}`);
          })();

  const keysLedger = listKeys(dayPrefixLedger);
  const keysDocLedger = listKeys(dayPrefixDocLedger);
  const keysMailLedger = listKeys(dayPrefixMailLedger);
  const allKeys = [...keysLedger, ...keysDocLedger, ...keysMailLedger].filter(
    (k) => k.endsWith('.json') && !k.endsWith('index.jsonl') && !k.includes('/_pending/')
  );
  const entryKeys = [...new Set(allKeys)].sort();
  if (entryKeys.length > maxEntries)
    throw new Error(`Too many entries for ${dateStr}: ${entryKeys.length} > ${maxEntries}`);

  const countLedger = entryKeys.filter((k) => k.startsWith(ledgerPrefix + '/')).length;
  const countDocLedger = entryKeys.filter((k) => k.startsWith(docLedgerPrefix + '/')).length;
  const countMailLedger = entryKeys.filter((k) => k.startsWith(mailLedgerPrefix + '/')).length;
  console.log(
    `ROLLUP: date=${dateStr} entries=${entryKeys.length} (ledger=${countLedger} doc-ledger=${countDocLedger} mail-ledger=${countMailLedger}) backend=${backend} bucket=${bucket}`
  );

  const leaves = [];
  const manifest = [];

  for (const k of entryKeys) {
    const file = path.join(dlDir, path.basename(k).replace(/[^a-zA-Z0-9._-]/g, '_'));
    if (backend === 's3') downloadObjectS3(bucket, k, file);
    else downloadObjectGcs(bucket, k, file);

    const raw = fs.readFileSync(file, 'utf8');
    const j = JSON.parse(raw);
    // Leaf: fingerprint_sha256 (mail/verify), hash.new_sha256 (config_change), or content sha256
    const leaf =
      String(j.fingerprint_sha256 || '').trim() ||
      (j.hash && typeof j.hash === 'object' && String(j.hash.new_sha256 || '').trim()) ||
      sha256Hex(Buffer.from(raw, 'utf8'));
    leaves.push(leaf);
    const source = k.startsWith(docLedgerPrefix + '/')
      ? 'doc-ledger'
      : k.startsWith(mailLedgerPrefix + '/')
        ? 'mail-ledger'
        : 'ledger';
    manifest.push({
      key: k,
      source,
      pack_sha256: j?.pack?.sha256 ?? null,
      fingerprint_sha256: leaf,
      generated_at: j?.generated_at ?? null,
      signature_key_id: j?.signature?.key_id ?? null,
      result_exit_code: j?.result?.exit_code ?? null,
      kind: j?.kind ?? j?.type ?? null,
    });
  }

  const root = merkleRootHex(leaves);
  const rollup = {
    version: 1,
    domain: 'ledger-rollup',
    date_utc: dateStr,
    generated_at: new Date().toISOString(),
    backend,
    bucket,
    ledger_prefix: ledgerPrefix,
    doc_ledger_prefix: docLedgerPrefix,
    mail_ledger_prefix: mailLedgerPrefix,
    rollup_prefix: rollupPrefix,
    entries: {
      count: manifest.length,
      count_ledger: manifest.filter((m) => m.source === 'ledger').length,
      count_doc_ledger: manifest.filter((m) => m.source === 'doc-ledger').length,
      count_mail_ledger: manifest.filter((m) => m.source === 'mail-ledger').length,
      leaf_algo: 'sha256',
      merkle_algo: 'sha256(pairwise)',
      merkle_root_sha256: root,
    },
    preview: manifest.slice(0, 50),
  };

  const rollupDir = path.join(dlDir, `rollup-${dateStr}`);
  fs.mkdirSync(rollupDir, { recursive: true });
  const rollupPath = path.join(rollupDir, 'rollup.json');
  const manifestPath = path.join(rollupDir, 'manifest.json');
  fs.writeFileSync(rollupPath, JSON.stringify(rollup, null, 2), 'utf8');
  fs.writeFileSync(manifestPath, JSON.stringify({ version: 1, date_utc: dateStr, entries: manifest }, null, 2), 'utf8');

  if (writeAnchorReq) {
    const req = {
      version: 1,
      domain: 'ledger-rollup',
      date_utc: dateStr,
      merkle_root_sha256: root,
      note: 'Anchor ledger rollup Merkle root for tamper-evidence',
    };
    fs.writeFileSync(path.join(rollupDir, 'rollup_anchor_request.json'), JSON.stringify(req, null, 2), 'utf8');
  }

  const dstKeyBase = `${rollupPrefix}/${yyyy}/${mm}/${dd}`;
  const rollupKey = `${dstKeyBase}/rollup.json`;
  const manifestKey = `${dstKeyBase}/manifest.json`;

  if (backend === 's3') {
    uploadObjectS3(bucket, rollupKey, rollupPath, 'application/json');
    uploadObjectS3(bucket, manifestKey, manifestPath, 'application/json');
  } else {
    uploadObjectGcs(bucket, rollupKey, rollupPath, 'application/json');
    uploadObjectGcs(bucket, manifestKey, manifestPath, 'application/json');
  }

  console.log(`ROLLUP: uploaded ${rollupKey}`);

  if (runAnchorPublish) {
    const scriptPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'rollup-anchor-publish.ts');
    const cwd = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
    console.log('ROLLUP: running anchor publish...');
    const anchorResult = spawnSync(
      'npx',
      ['tsx', scriptPath, '--date', dateStr, '--merkle-root', root, '--backend', backend, '--bucket', bucket, '--rollup-prefix', rollupPrefix],
      { stdio: 'inherit', cwd, env: { ...process.env, LEDGER_BACKEND: backend, LEDGER_BUCKET: bucket, LEDGER_ROLLUP_PREFIX: rollupPrefix } }
    );
    if (anchorResult.status !== 0) {
      console.log('ROLLUP: anchor publish failed (rollup already uploaded)');
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e?.stack || String(e));
    process.exit(2);
  });
}
