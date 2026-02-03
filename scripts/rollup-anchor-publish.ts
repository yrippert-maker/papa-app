#!/usr/bin/env npx tsx
/**
 * Publish ledger-rollup Merkle root to chain and write ROLLUP_ANCHORING_STATUS.json to S3/GCS.
 * Called by ledger-rollup.mjs when LEDGER_ROLLUP_ANCHOR=1.
 *
 * Usage:
 *   npx tsx scripts/rollup-anchor-publish.ts --date YYYY-MM-DD --merkle-root <hex> --backend s3 --bucket <bucket> [--rollup-prefix ledger-rollups]
 *
 * Env: LEDGER_BACKEND, LEDGER_BUCKET, LEDGER_ROLLUP_PREFIX, ANCHOR_*, ANCHORING_PUBLISH_ENABLED
 */
import { publishRollupAnchor } from '../lib/anchor-publisher';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

function argVal(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  if (i === -1) return null;
  return process.argv[i + 1] ?? null;
}

function run(cmd: string, args: string[], opts: { capture?: boolean } = {}) {
  const r = spawnSync(cmd, args, {
    stdio: opts.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    shell: process.platform === 'win32',
  });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    const out = (r.stdout || Buffer.from('')).toString('utf8');
    const err = (r.stderr || Buffer.from('')).toString('utf8');
    throw new Error(`Command failed: ${cmd} ${args.join(' ')} (exit ${r.status})\n${out}\n${err}`);
  }
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

async function main() {
  const dateStr = (argVal('--date') ?? process.env.LEDGER_ROLLUP_ANCHOR_DATE ?? '').trim();
  const merkleRoot = (argVal('--merkle-root') ?? process.env.LEDGER_ROLLUP_MERKLE_ROOT ?? '').trim();
  const backend = (argVal('--backend') ?? process.env.LEDGER_BACKEND ?? '').trim();
  const bucket = (argVal('--bucket') ?? process.env.LEDGER_BUCKET ?? '').trim();
  const rollupPrefix = (argVal('--rollup-prefix') ?? process.env.LEDGER_ROLLUP_PREFIX ?? 'ledger-rollups').replace(/^\/+|\/+$/g, '');

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    console.error('Missing or invalid --date YYYY-MM-DD');
    process.exit(2);
  }
  if (!merkleRoot) {
    console.error('Missing --merkle-root');
    process.exit(2);
  }

  const result = await publishRollupAnchor({ date_utc: dateStr, merkle_root_sha256: merkleRoot });

  const [y, m, d] = dateStr.split('-');
  const statusPayload = {
    version: 1,
    domain: 'ledger-rollup',
    date_utc: dateStr,
    anchored: result.ok,
    network: result.network ?? null,
    tx_hash: result.tx_hash ?? null,
    timestamp: new Date().toISOString(),
    verifier: 'rollup-anchor-publish',
    ...(result.error ? { error: result.error } : {}),
  };

  if (!result.ok) {
    console.error('[rollup-anchor-publish] Publish failed:', result.error);
    if (backend && bucket) {
      statusPayload.anchored = false;
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rollup-anchor-'));
      const statusPath = path.join(tmpDir, 'ROLLUP_ANCHORING_STATUS.json');
      fs.writeFileSync(statusPath, JSON.stringify(statusPayload, null, 2), 'utf8');
      const statusKey = `${rollupPrefix}/${y}/${m}/${d}/ROLLUP_ANCHORING_STATUS.json`;
      try {
        if (backend === 's3') {
          run('aws', ['s3', 'cp', statusPath, `s3://${bucket}/${statusKey}`, '--content-type', 'application/json']);
        } else if (backend === 'gcs') {
          run('gsutil', ['-h', 'Content-Type:application/json', 'cp', statusPath, `gs://${bucket}/${statusKey}`]);
        }
        console.log('[rollup-anchor-publish] Wrote ROLLUP_ANCHORING_STATUS.json (anchored=false)');
      } finally {
        try {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch {}
      }
    }
    process.exit(1);
  }

  console.log('[rollup-anchor-publish] Tx:', result.tx_hash);

  if (!backend || !bucket) {
    console.log('[rollup-anchor-publish] Skip upload (no LEDGER_BACKEND/LEDGER_BUCKET)');
    return;
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rollup-anchor-'));
  const statusPath = path.join(tmpDir, 'ROLLUP_ANCHORING_STATUS.json');
  fs.writeFileSync(statusPath, JSON.stringify(statusPayload, null, 2), 'utf8');
  const statusKey = `${rollupPrefix}/${y}/${m}/${d}/ROLLUP_ANCHORING_STATUS.json`;

  if (backend === 's3') {
    run('aws', ['s3', 'cp', statusPath, `s3://${bucket}/${statusKey}`, '--content-type', 'application/json']);
  } else if (backend === 'gcs') {
    run('gsutil', ['-h', 'Content-Type:application/json', 'cp', statusPath, `gs://${bucket}/${statusKey}`]);
  } else {
    console.error('Unknown backend:', backend);
    process.exit(2);
  }

  console.log('[rollup-anchor-publish] Uploaded', statusKey);
}

main().catch((e) => {
  console.error(e?.stack ?? String(e));
  process.exit(2);
});
