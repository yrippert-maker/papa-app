#!/usr/bin/env node
/**
 * Standalone ledger verification — same logic as lib/ledger-hash.ts.
 * Output: LEDGER_VERIFY_RESULT.txt (JSON Schema v1) for regulatory bundle.
 *
 * Env: TAG, COMMIT, GENERATED_AT, OUTPUT_PATH, WORKSPACE_ROOT, DB_PATH
 */
import Database from 'better-sqlite3';
import crypto from 'crypto';
import { existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { buildLedgerVerifyResult, writeLedgerVerifyResultCanonical } from '../lib/ledger-verify-result.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = join(__dirname, '..');
const defaultDbPath = join(
  process.env.WORKSPACE_ROOT || join(root, 'data'),
  '00_SYSTEM/db/papa.sqlite'
);
const dbPath = process.env.DB_PATH || defaultDbPath;
const outputPath = process.env.OUTPUT_PATH || join(root, 'dist', 'LEDGER_VERIFY_RESULT.txt');

function computeEventHash({ prev_hash, event_type, ts_utc, actor_id, canonical_payload_json }) {
  const prev = prev_hash ?? '';
  const actor = actor_id ?? '';
  const input = `${event_type}\n${ts_utc}\n${actor}\n${canonical_payload_json}\n${prev}`;
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

function computeEventHashLegacy({ prev_hash, event_type, canonical_payload_json }) {
  const prev = prev_hash ?? '';
  const input = `${event_type}\n${canonical_payload_json}\n${prev}`;
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

function verifyLedgerChain(events) {
  let expectedPrev = null;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    const prevStr = expectedPrev ?? '';
    if ((e.prev_hash ?? '') !== prevStr) {
      throw new Error(`Chain break at index ${i}`);
    }
    const recomputed =
      e.actor_id != null && e.actor_id !== ''
        ? computeEventHash({
            prev_hash: e.prev_hash,
            event_type: e.event_type,
            ts_utc: e.created_at ?? '',
            actor_id: e.actor_id,
            canonical_payload_json: e.payload_json,
          })
        : computeEventHashLegacy({
            prev_hash: e.prev_hash,
            event_type: e.event_type,
            canonical_payload_json: e.payload_json,
          });
    if (recomputed !== e.block_hash) {
      throw new Error(`Hash mismatch at index ${i}`);
    }
    expectedPrev = e.block_hash;
  }
  return true;
}

function getDbSource() {
  const p = dbPath.replace(/\\/g, '/');
  if (p.includes('.tmp/e2e-workspace')) return 'e2e';
  if (p.includes('/data/') || p.endsWith('/data')) return 'data';
  if (!existsSync(dbPath)) return 'none';
  return 'unknown';
}

function getDbPathUsed() {
  if (!existsSync(dbPath)) return null;
  const rel = dbPath.replace(root.replace(/\\/g, '/'), '').replace(/^[/\\]/, '');
  return rel || dbPath;
}

function getFormulaVersion(rows) {
  if (!rows || rows.length === 0) return 'normative_only';
  const hasLegacy = rows.some((r) => r.actor_id == null || r.actor_id === '');
  const hasNormative = rows.some((r) => r.actor_id != null && r.actor_id !== '');
  if (hasLegacy && hasNormative) return 'mixed';
  if (hasLegacy) return 'legacy_only';
  return 'normative_only';
}

function main() {
  const tag = process.env.TAG || 'v0.1.1';
  const commit = process.env.COMMIT || 'unknown';
  const generatedAt = process.env.GENERATED_AT || new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  const t0 = Date.now();

  if (!existsSync(dbPath)) {
    const result = buildLedgerVerifyResult({
      release: { tag, commit, generated_at_utc: generatedAt },
      bundle_ok: true,
      ledger_verification: {
        executed: false,
        skipped: true,
        ledger_ok: null,
        message: 'Ledger verification skipped',
        skip_reason: 'No database found',
        db: { db_mode: 'readonly', db_source: 'none', db_path_used: null },
        scope: { table: 'ledger_events', order_by: 'id ASC', event_count: 0, id_min: null, id_max: null },
      },
    });
    writeLedgerVerifyResultCanonical(outputPath, result);
    return;
  }

  const db = new Database(dbPath, { readonly: true });
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ledger_events'").get();
    if (!tables) {
      db.close();
      const result = buildLedgerVerifyResult({
        release: { tag, commit, generated_at_utc: generatedAt },
        bundle_ok: true,
        ledger_verification: {
          executed: false,
          skipped: true,
          ledger_ok: null,
          message: 'Ledger verification skipped',
          skip_reason: 'Table ledger_events not found',
          db: {
            db_mode: 'readonly',
            db_source: getDbSource(),
            db_path_used: getDbPathUsed(),
          },
          scope: { table: 'ledger_events', order_by: 'id ASC', event_count: 0, id_min: null, id_max: null },
        },
      });
      writeLedgerVerifyResultCanonical(outputPath, result);
      return;
    }

    const tRead = Date.now();
    const rows = db.prepare(
      'SELECT id, event_type, payload_json, prev_hash, block_hash, created_at, actor_id FROM ledger_events ORDER BY id'
    ).all();
    const readMs = Date.now() - tRead;

    if (rows.length === 0) {
      const totalMs = Date.now() - t0;
      const result = buildLedgerVerifyResult({
        release: { tag, commit, generated_at_utc: generatedAt },
        bundle_ok: true,
        ledger_verification: {
          executed: true,
          skipped: false,
          ledger_ok: true,
          message: 'Ledger integrity verified (empty)',
          formula_version: 'normative_only',
          db: {
            db_mode: 'readonly',
            db_source: getDbSource(),
            db_path_used: getDbPathUsed(),
          },
          scope: { table: 'ledger_events', order_by: 'id ASC', event_count: 0, id_min: null, id_max: null },
          timing_ms: { read: readMs, verify: 0, total: totalMs },
        },
      });
      writeLedgerVerifyResultCanonical(outputPath, result);
      return;
    }

    const tVerify = Date.now();
    verifyLedgerChain(rows);
    const verifyMs = Date.now() - tVerify;
    const totalMs = Date.now() - t0;

    const idMin = rows[0]?.id ?? null;
    const idMax = rows[rows.length - 1]?.id ?? null;

    const result = buildLedgerVerifyResult({
      release: { tag, commit, generated_at_utc: generatedAt },
      bundle_ok: true,
      ledger_verification: {
        executed: true,
        skipped: false,
        ledger_ok: true,
        message: 'Ledger integrity verified',
        formula_version: getFormulaVersion(rows),
        db: {
          db_mode: 'readonly',
          db_source: getDbSource(),
          db_path_used: getDbPathUsed(),
        },
        scope: {
          table: 'ledger_events',
          order_by: 'id ASC',
          event_count: rows.length,
          id_min: idMin,
          id_max: idMax,
        },
        timing_ms: { read: readMs, verify: verifyMs, total: totalMs },
      },
    });
    writeLedgerVerifyResultCanonical(outputPath, result);
  } catch (e) {
    const totalMs = Date.now() - t0;
    let formulaVer = 'normative_only';
    try {
      const errRows = db.prepare('SELECT actor_id FROM ledger_events').all();
      formulaVer = getFormulaVersion(errRows);
    } catch {
      /* ignore */
    }
    const result = buildLedgerVerifyResult({
      release: { tag, commit, generated_at_utc: generatedAt },
      bundle_ok: true,
      ledger_verification: {
        executed: true,
        skipped: false,
        ledger_ok: false,
        message: e instanceof Error ? e.message : String(e),
        formula_version: formulaVer,
        db: {
          db_mode: 'readonly',
          db_source: getDbSource(),
          db_path_used: getDbPathUsed(),
        },
        scope: { table: 'ledger_events', order_by: 'id ASC', event_count: 0, id_min: null, id_max: null },
        timing_ms: { total: totalMs },
      },
    });
    writeLedgerVerifyResultCanonical(outputPath, result);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

main();
