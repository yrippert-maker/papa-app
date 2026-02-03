#!/usr/bin/env node
/**
 * GC for doc-ledger _pending: delete stale pending objects older than N hours.
 * Supports S3 and GCS (symmetry with ledger-publish/rollup).
 * Safety: --max-delete, --max-bytes, --require-confirm, --confirm DELETE, --report path.
 * Usage: node scripts/config-ledger-gc.mjs [--backend s3|gcs] [--bucket B] [--pending-prefix P] [--older-than-hours 24] [--dry-run] [--max-delete 1000] [--max-bytes 262144000] [--require-confirm] [--confirm DELETE] [--report path.json]
 * Env: LEDGER_BACKEND, LEDGER_BUCKET, DOC_LEDGER_*, PENDING_GC_*, DRY_RUN, CONFIRM, PENDING_GC_REPORT_PATH
 */
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { Storage } from '@google-cloud/storage';
import fs from 'node:fs';

function arg(name) {
  const i = process.argv.indexOf(name);
  if (i >= 0) return process.argv[i + 1] || null;
  return null;
}

function isTruthy(v) {
  return v === '1' || v === 'true' || v === 'yes';
}

function nowIso() {
  return new Date().toISOString();
}

function normPrefix(p) {
  const s = String(p || '').replace(/^\/+|\/+$/g, '');
  return s ? (s.endsWith('/') ? s : `${s}/`) : '';
}

function toNum(v, def) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

async function listAllKeysS3(s3, bucket, prefix) {
  const keys = [];
  let token = undefined;
  for (;;) {
    const r = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: token,
        MaxKeys: 1000,
      })
    );
    for (const o of r.Contents || []) {
      if (o.Key)
        keys.push({
          key: o.Key,
          lastModified: o.LastModified ? new Date(o.LastModified).getTime() : 0,
          size: o.Size || 0,
        });
    }
    if (!r.IsTruncated) break;
    token = r.NextContinuationToken;
  }
  return keys;
}

async function deleteBatchS3(s3, bucket, keys) {
  if (keys.length === 0) return { deleted: 0, errors: 0 };
  const r = await s3.send(
    new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: keys.map((k) => ({ Key: k })),
        Quiet: true,
      },
    })
  );
  const deleted = (r.Deleted || []).length;
  const errors = (r.Errors || []).length;
  return { deleted, errors };
}

async function listAllKeysGcs(storage, bucket, prefix) {
  const out = [];
  const b = storage.bucket(bucket);
  const [files] = await b.getFiles({ prefix });
  for (const f of files) {
    const md = f.metadata || {};
    const updated = md.updated || md.timeCreated || null;
    const lm = updated ? Date.parse(updated) : 0;
    const size = md.size ? Number(md.size) : 0;
    out.push({ key: f.name, lastModified: Number.isFinite(lm) ? lm : 0, size });
  }
  return out;
}

async function deleteBatchGcs(storage, bucket, keys) {
  if (keys.length === 0) return { deleted: 0, errors: 0 };
  const b = storage.bucket(bucket);
  let deleted = 0;
  let errors = 0;
  const concurrency = 20;
  for (let i = 0; i < keys.length; i += concurrency) {
    const chunk = keys.slice(i, i + concurrency);
    const res = await Promise.allSettled(
      chunk.map((k) => b.file(k).delete({ ignoreNotFound: true }))
    );
    for (const r of res) {
      if (r.status === 'fulfilled') deleted++;
      else errors++;
    }
  }
  return { deleted, errors };
}

async function main() {
  const backend = (arg('--backend') || process.env.LEDGER_BACKEND || 's3').trim();
  if (!['s3', 'gcs'].includes(backend)) {
    console.error('Bad backend. Use --backend s3|gcs (or LEDGER_BACKEND).');
    process.exit(1);
  }

  const bucket = (arg('--bucket') || process.env.LEDGER_BUCKET || '').trim();
  if (!bucket) {
    console.error('Missing bucket. Provide --bucket or LEDGER_BUCKET.');
    process.exit(1);
  }
  const pendingPrefix = normPrefix(
    arg('--pending-prefix') ||
      process.env.DOC_LEDGER_PENDING_PREFIX ||
      (process.env.DOC_LEDGER_PREFIX ? `${process.env.DOC_LEDGER_PREFIX}/_pending` : 'doc-ledger/_pending')
  );

  const olderHours = toNum(arg('--older-than-hours') || process.env.PENDING_GC_OLDER_THAN_HOURS || '24', 24);
  if (!Number.isFinite(olderHours) || olderHours <= 0) {
    console.error('Invalid older-than-hours (must be > 0)');
    process.exit(1);
  }
  const dryRun = isTruthy(arg('--dry-run') || process.env.DRY_RUN || '0');
  const maxDelete = toNum(arg('--max-delete') || process.env.PENDING_GC_MAX_DELETE || '1000', 1000);
  const maxBytes = toNum(arg('--max-bytes') || process.env.PENDING_GC_MAX_BYTES || String(250 * 1024 * 1024), 250 * 1024 * 1024);
  const requireConfirm = isTruthy(arg('--require-confirm') || process.env.PENDING_GC_REQUIRE_CONFIRM || '1');
  const confirm = (arg('--confirm') || process.env.CONFIRM || '').trim();
  const reportPath = (arg('--report') || process.env.PENDING_GC_REPORT_PATH || '').trim();

  const cutoff = Date.now() - olderHours * 60 * 60 * 1000;

  console.log(
    `[${nowIso()}] pending-gc: backend=${backend} bucket=${bucket} prefix=${pendingPrefix} olderThanHours=${olderHours} dryRun=${dryRun}`
  );

  let items = [];
  let deleter = null;
  if (backend === 's3') {
    const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
    items = await listAllKeysS3(s3, bucket, pendingPrefix);
    deleter = async (keys) => {
      let totalDeleted = 0;
      let totalErrors = 0;
      for (let i = 0; i < keys.length; i += 1000) {
        const chunk = keys.slice(i, i + 1000);
        const r = await deleteBatchS3(s3, bucket, chunk);
        totalDeleted += r.deleted;
        totalErrors += r.errors;
        console.log(`deleted chunk=${chunk.length} deleted=${r.deleted} errors=${r.errors}`);
      }
      return { deleted: totalDeleted, errors: totalErrors };
    };
  } else {
    const storage = new Storage();
    items = await listAllKeysGcs(storage, bucket, pendingPrefix);
    deleter = async (keys) => {
      const r = await deleteBatchGcs(storage, bucket, keys);
      console.log(`deleted batch=${keys.length} deleted=${r.deleted} errors=${r.errors}`);
      return r;
    };
  }

  const stale = items.filter((x) => x.lastModified > 0 && x.lastModified < cutoff);

  console.log(`found=${items.length} stale=${stale.length} fresh=${items.length - stale.length}`);
  if (stale.length === 0) return;

  const sorted = [...stale].sort((a, b) => a.lastModified - b.lastModified);
  const keysToDelete = [];
  let totalBytes = 0;
  for (const x of sorted) {
    if (keysToDelete.length >= maxDelete) break;
    if (totalBytes + (x.size || 0) > maxBytes) break;
    keysToDelete.push(x.key);
    totalBytes += x.size || 0;
  }

  const report = {
    generated_at: nowIso(),
    backend,
    bucket,
    prefix: pendingPrefix,
    older_than_hours: olderHours,
    cutoff_epoch_ms: cutoff,
    found: items.length,
    stale: stale.length,
    selected: keysToDelete.length,
    selected_bytes: totalBytes,
    dry_run: dryRun,
    max_delete: maxDelete,
    max_bytes: maxBytes,
  };
  if (reportPath) {
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`report written: ${reportPath}`);
  }

  if (dryRun) {
    console.log(`dry-run: would delete ${keysToDelete.length} objects`);
    console.log(`dry-run: example=${keysToDelete[0]}`);
    return;
  }

  if (requireConfirm && confirm !== 'DELETE') {
    console.error(
      `refusing to delete without confirmation. Set --confirm DELETE (or CONFIRM=DELETE). selected=${keysToDelete.length}`
    );
    process.exit(2);
  }

  const r = await deleter(keysToDelete);
  console.log(`done deleted_total=${r.deleted} errors_total=${r.errors}`);
  if (r.errors > 0) process.exitCode = 2;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
