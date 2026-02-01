/**
 * LEDGER_VERIFY_RESULT.txt — JSON Schema v1.
 * Stable format for regulatory evidence; schema_version enables future evolution.
 */
import fs from 'node:fs';
import path from 'node:path';
import { canonicalJSONStringify } from './canonical-json.mjs';

export const LEDGER_VERIFY_SCHEMA_VERSION = 1;

function isIsoUtcZ(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(s);
}

function assert(cond, msg) {
  if (!cond) throw new Error(`LEDGER_VERIFY_RESULT invariant failed: ${msg}`);
}

/**
 * Build and validate LEDGER_VERIFY_RESULT v1.
 * @param {{ release: { tag: string, commit: string, generated_at_utc: string }, bundle_ok?: boolean, ledger_verification: object }} args
 */
export function buildLedgerVerifyResult({ release, bundle_ok = true, ledger_verification }) {
  assert(release && typeof release === 'object', 'release is required');
  assert(typeof release.tag === 'string' && release.tag.length > 0, 'release.tag is required');
  assert(typeof release.commit === 'string' && release.commit.length > 0, 'release.commit is required');
  assert(isIsoUtcZ(release.generated_at_utc), 'release.generated_at_utc must be ISO8601 UTC with Z');

  assert(typeof bundle_ok === 'boolean', 'bundle_ok must be boolean');

  const lv = ledger_verification;
  assert(lv && typeof lv === 'object', 'ledger_verification is required');
  assert(typeof lv.executed === 'boolean', 'ledger_verification.executed must be boolean');
  assert(typeof lv.skipped === 'boolean', 'ledger_verification.skipped must be boolean');
  assert(
    lv.ledger_ok === null || typeof lv.ledger_ok === 'boolean',
    'ledger_verification.ledger_ok must be boolean or null'
  );
  assert(typeof lv.message === 'string' && lv.message.length > 0, 'ledger_verification.message is required');

  if (lv.skipped) {
    assert(lv.executed === false, 'if skipped=true then executed must be false');
    assert(lv.ledger_ok === null, 'if skipped=true then ledger_ok must be null');
    assert(
      typeof lv.skip_reason === 'string' && lv.skip_reason.length > 0,
      'if skipped=true then skip_reason is required'
    );
  } else {
    assert(lv.executed === true, 'if skipped=false then executed must be true');
    assert(lv.ledger_ok !== null, 'if skipped=false then ledger_ok must be true/false');
    assert(lv.scope != null, 'if executed=true then scope MUST be present');
  }

  if (lv.formula_version) {
    assert(
      ['mixed', 'normative_only', 'legacy_only'].includes(lv.formula_version),
      'formula_version must be mixed | normative_only | legacy_only'
    );
  }

  if (lv.db) {
    assert(lv.db.db_mode === 'readonly', 'ledger verification MUST use db_mode=readonly');
    assert(['e2e', 'data', 'none', 'unknown'].includes(lv.db.db_source), 'db.db_source invalid');
    assert(
      lv.db.db_path_used === null || typeof lv.db.db_path_used === 'string',
      'db.db_path_used must be string|null'
    );
  }

  if (lv.scope) {
    assert(lv.scope.table === 'ledger_events', 'scope.table must be "ledger_events"');
    assert(typeof lv.scope.order_by === 'string' && lv.scope.order_by.length > 0, 'scope.order_by required');
    assert(
      Number.isInteger(lv.scope.event_count) && lv.scope.event_count >= 0,
      'scope.event_count must be integer >= 0'
    );
    assert(lv.scope.id_min === null || Number.isInteger(lv.scope.id_min), 'scope.id_min must be integer|null');
    assert(lv.scope.id_max === null || Number.isInteger(lv.scope.id_max), 'scope.id_max must be integer|null');
    if (lv.scope.event_count === 0) {
      assert(lv.scope.id_min === null && lv.scope.id_max === null, 'if event_count=0 then id_min/id_max must be null');
    }
  }

  if (lv.timing_ms) {
    for (const k of ['read', 'verify', 'total']) {
      if (lv.timing_ms[k] !== undefined) {
        assert(Number.isFinite(lv.timing_ms[k]) && lv.timing_ms[k] >= 0, `timing_ms.${k} must be number >= 0`);
      }
    }
  }

  return {
    schema_version: LEDGER_VERIFY_SCHEMA_VERSION,
    release: {
      tag: release.tag,
      commit: release.commit,
      generated_at_utc: release.generated_at_utc,
    },
    bundle_ok,
    ledger_verification: { ...lv },
  };
}

/**
 * Write LEDGER_VERIFY_RESULT.txt as canonical JSON.
 * Keys sorted lexicographically by Unicode code points; no whitespace.
 */
export function writeLedgerVerifyResultCanonical(outFilePath, result) {
  assert(typeof outFilePath === 'string' && outFilePath.length > 0, 'outFilePath is required');
  assert(result && typeof result === 'object', 'result is required');

  const dir = path.dirname(outFilePath);
  fs.mkdirSync(dir, { recursive: true });

  const canon = canonicalJSONStringify(result);
  fs.writeFileSync(outFilePath, canon + '\n', { encoding: 'utf8' });
}
