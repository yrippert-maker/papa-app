/**
 * AUTHZ_VERIFY_RESULT.txt — JSON Schema v1.
 * Stable format for regulatory evidence; schema_version enables future evolution.
 */
import fs from 'node:fs';
import path from 'node:path';
import { canonicalJSONStringify } from './canonical-json.mjs';

export const AUTHZ_VERIFY_SCHEMA_VERSION = 1;

function isIsoUtcZ(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(s);
}

function assert(cond, msg) {
  if (!cond) throw new Error(`AUTHZ_VERIFY_RESULT invariant failed: ${msg}`);
}

/**
 * Build and validate AUTHZ_VERIFY_RESULT v1.
 * @param {{ release: { tag: string, commit: string, generated_at_utc: string }, bundle_ok?: boolean, authz_verification: object }} args
 */
export function buildAuthzVerifyResult({ release, bundle_ok = true, authz_verification }) {
  assert(release && typeof release === 'object', 'release is required');
  assert(typeof release.tag === 'string' && release.tag.length > 0, 'release.tag is required');
  assert(typeof release.commit === 'string' && release.commit.length > 0, 'release.commit is required');
  assert(isIsoUtcZ(release.generated_at_utc), 'release.generated_at_utc must be ISO8601 UTC with Z');

  assert(typeof bundle_ok === 'boolean', 'bundle_ok must be boolean');

  const av = authz_verification;
  assert(av && typeof av === 'object', 'authz_verification is required');
  assert(typeof av.executed === 'boolean', 'authz_verification.executed must be boolean');
  assert(typeof av.skipped === 'boolean', 'authz_verification.skipped must be boolean');
  assert(
    av.authz_ok === null || typeof av.authz_ok === 'boolean',
    'authz_verification.authz_ok must be boolean or null'
  );
  assert(typeof av.message === 'string' && av.message.length > 0, 'authz_verification.message is required');

  if (av.skipped) {
    assert(av.executed === false, 'if skipped=true then executed must be false');
    assert(av.authz_ok === null, 'if skipped=true then authz_ok must be null');
    assert(
      typeof av.skip_reason === 'string' && av.skip_reason.length > 0,
      'if skipped=true then skip_reason is required'
    );
  } else {
    assert(av.executed === true, 'if skipped=false then executed must be true');
    assert(av.authz_ok !== null, 'if skipped=false then authz_ok must be true/false');
    assert(av.scope != null, 'if executed=true then scope MUST be present');
  }

  if (av.scope) {
    assert(typeof av.scope.route_registry_file === 'string', 'scope.route_registry_file required');
    assert(Number.isInteger(av.scope.route_count) && av.scope.route_count >= 0, 'scope.route_count must be integer >= 0');
    assert(typeof av.scope.unique_routes === 'boolean', 'scope.unique_routes required');
    assert(typeof av.scope.permissions_valid === 'boolean', 'scope.permissions_valid required');
  }

  return {
    schema_version: AUTHZ_VERIFY_SCHEMA_VERSION,
    release: {
      tag: release.tag,
      commit: release.commit,
      generated_at_utc: release.generated_at_utc,
    },
    bundle_ok,
    authz_verification: { ...av },
  };
}

/**
 * Write AUTHZ_VERIFY_RESULT.txt as canonical JSON.
 */
export function writeAuthzVerifyResultCanonical(outFilePath, result) {
  assert(typeof outFilePath === 'string' && outFilePath.length > 0, 'outFilePath is required');
  assert(result && typeof result === 'object', 'result is required');

  const dir = path.dirname(outFilePath);
  fs.mkdirSync(dir, { recursive: true });

  const canon = canonicalJSONStringify(result);
  fs.writeFileSync(outFilePath, canon + '\n', { encoding: 'utf8' });
}
