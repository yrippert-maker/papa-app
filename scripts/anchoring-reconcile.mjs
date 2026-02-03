#!/usr/bin/env node
/**
 * anchoring:reconcile — проверка полноты anchors за период.
 * - Для каждого дня: есть ли anchor row
 * - Для anchor с tx_hash: status=confirmed, receipt сохранён
 * - Опция --fix: создать пропущенные anchors (anchoring:run)
 *
 * Usage:
 *   node scripts/anchoring-reconcile.mjs
 *   node scripts/anchoring-reconcile.mjs --from 2026-01-01 --to 2026-02-01
 *   node scripts/anchoring-reconcile.mjs --from 2026-01-01 --to 2026-02-01 --fix
 */
import Database from 'better-sqlite3';
import { existsSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || join(ROOT, 'data');
const DB_PATH = join(WORKSPACE_ROOT, '00_SYSTEM', 'db', 'papa.sqlite');
const RECEIPTS_DIR = join(WORKSPACE_ROOT, '00_SYSTEM', 'anchor-receipts');

function parseArgs() {
  const args = process.argv.slice(2);
  const fromIdx = args.indexOf('--from');
  const toIdx = args.indexOf('--to');
  const fix = args.includes('--fix');
  const from = fromIdx >= 0 && args[fromIdx + 1] ? args[fromIdx + 1] : null;
  const to = toIdx >= 0 && args[toIdx + 1] ? args[toIdx + 1] : null;
  return { from, to, fix };
}

function dateRange(fromStr, toStr) {
  const to = toStr ? new Date(toStr) : new Date();
  const from = fromStr ? new Date(fromStr) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  const days = [];
  const d = new Date(from);
  d.setUTCHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setUTCHours(23, 59, 59, 999);
  while (d <= end) {
    days.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return days;
}

function main() {
  const { from, to, fix } = parseArgs();
  const days = dateRange(from, to);

  if (!existsSync(DB_PATH)) {
    console.error('[anchoring:reconcile] DB not found:', DB_PATH);
    process.exit(1);
  }

  const db = new Database(DB_PATH);

  const missing = [];
  const pendingPublish = [];
  const pendingConfirm = [];
  const receiptMissing = [];
  const ok = [];

  for (const day of days) {
    const periodStart = day + 'T00:00:00.000Z';
    const periodEnd = day + 'T23:59:59.999Z';
    const row = db
      .prepare(
        `SELECT id, status, tx_hash, events_count FROM ledger_anchors WHERE period_start = ? AND period_end = ?`
      )
      .get(periodStart, periodEnd);

    if (!row) {
      missing.push(day);
      continue;
    }

    if (row.status === 'empty') {
      ok.push({ day, status: 'empty' });
      continue;
    }

    if (row.status === 'pending' && !row.tx_hash) {
      pendingPublish.push({ day, id: row.id });
      continue;
    }

    if (row.status === 'pending' && row.tx_hash) {
      const txHex = row.tx_hash.replace(/^0x/, '');
      const receiptPath = join(RECEIPTS_DIR, `${txHex}.json`);
      if (!existsSync(receiptPath)) {
        receiptMissing.push({ day, id: row.id, tx_hash: row.tx_hash });
      }
      pendingConfirm.push({ day, id: row.id });
      continue;
    }

    if (row.status === 'confirmed' && row.tx_hash) {
      const txHex = row.tx_hash.replace(/^0x/, '');
      const receiptPath = join(RECEIPTS_DIR, `${txHex}.json`);
      if (!existsSync(receiptPath)) {
        receiptMissing.push({ day, id: row.id, tx_hash: row.tx_hash });
      }
      ok.push({ day, status: 'confirmed' });
      continue;
    }

    if (row.status === 'failed') {
      ok.push({ day, status: 'failed' });
    }
  }

  db.close();

  // Report
  console.log('[anchoring:reconcile] Period:', days[0], '…', days[days.length - 1], `(${days.length} days)`);
  console.log('[anchoring:reconcile] OK (empty/confirmed/failed):', ok.length);
  if (missing.length > 0) {
    console.log('[anchoring:reconcile] Missing anchors:', missing.length, missing.slice(0, 5).join(', ') + (missing.length > 5 ? '…' : ''));
  }
  if (pendingPublish.length > 0) {
    console.log('[anchoring:reconcile] Pending publish (no tx):', pendingPublish.length);
  }
  if (pendingConfirm.length > 0) {
    console.log('[anchoring:reconcile] Pending confirm (tx sent):', pendingConfirm.length);
  }
  if (receiptMissing.length > 0) {
    console.log('[anchoring:reconcile] Receipt file missing:', receiptMissing.length);
  }

  // Fix: create missing anchors
  if (fix && missing.length > 0) {
    console.log('[anchoring:reconcile] --fix: creating missing anchors…');
    const workDir = join(ROOT);
    for (const day of missing) {
      const r = spawnSync('node', ['scripts/anchoring-run.mjs', '--period', day], {
        cwd: workDir,
        env: { ...process.env, WORKSPACE_ROOT },
        stdio: 'inherit',
      });
      if (r.status !== 0) {
        console.error('[anchoring:reconcile] Failed for', day);
      }
    }
    console.log('[anchoring:reconcile] Done. Re-run without --fix to verify.');
  } else if (missing.length > 0 && !fix) {
    console.log('[anchoring:reconcile] Tip: run with --fix to create missing anchors');
  }

  const hasIssues = missing.length > 0 || pendingPublish.length > 0 || receiptMissing.length > 0;
  process.exit(hasIssues && !fix ? 1 : 0);
}

main();
