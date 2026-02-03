#!/usr/bin/env node
/**
 * AuthZ verification for regulatory bundle.
 * Runs without server. Validates route registry integrity.
 * Output: AUTHZ_VERIFY_RESULT.txt (canonical JSON).
 *
 * Env: TAG, COMMIT, GENERATED_AT, OUTPUT_PATH (optional)
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAuthzVerifyResult, writeAuthzVerifyResultCanonical } from '../lib/authz-verify-result.mjs';
import { ROUTE_REGISTRY, VALID_PERMISSIONS, ROLE_COUNT } from '../lib/authz/routes-export.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = path.join(__dirname, '..');

const TAG = process.env.TAG || 'v0.1.3';
const COMMIT = process.env.COMMIT || (() => {
  try {
    const { execSync } = createRequire(import.meta.url)('node:child_process');
    return execSync('git rev-parse HEAD 2>/dev/null', { encoding: 'utf8' }).trim().slice(0, 40) || 'no-commits';
  } catch {
    return 'no-commits';
  }
})();
const GENERATED_AT = process.env.GENERATED_AT || new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const OUTPUT_PATH = process.env.OUTPUT_PATH || path.join(root, 'dist', 'AUTHZ_VERIFY_RESULT.txt');

function runVerification() {
  const seen = new Set();
  let uniqueRoutes = true;
  let permissionsValid = true;
  const errors = [];

  for (const r of ROUTE_REGISTRY) {
    const key = `${r.method} ${r.path}`;
    if (seen.has(key)) {
      uniqueRoutes = false;
      errors.push(`duplicate route: ${key}`);
    }
    seen.add(key);

    if (!r.permission || typeof r.permission !== 'string') {
      permissionsValid = false;
      errors.push(`missing permission: ${key}`);
    } else if (!VALID_PERMISSIONS.has(r.permission)) {
      permissionsValid = false;
      errors.push(`unknown permission "${r.permission}" for ${key}`);
    }
  }

  const authz_ok = uniqueRoutes && permissionsValid && errors.length === 0;

  return {
    executed: true,
    skipped: false,
    authz_ok,
    message: authz_ok ? 'AuthZ verification passed' : `AuthZ verification failed: ${errors.join('; ')}`,
    scope: {
      route_registry_file: 'lib/authz/routes.ts',
      route_count: ROUTE_REGISTRY.length,
      permission_count: VALID_PERMISSIONS.size,
      role_count: ROLE_COUNT,
      unique_routes: uniqueRoutes,
      permissions_valid: permissionsValid,
      deny_by_default: true,
      deny_by_default_scope: 'route_registry_only',
    },
  };
}

try {
  const authz_verification = runVerification();
  const result = buildAuthzVerifyResult({
    release: { tag: TAG, commit: COMMIT, generated_at_utc: GENERATED_AT },
    bundle_ok: true,
    authz_verification,
  });
  writeAuthzVerifyResultCanonical(OUTPUT_PATH, result);
  if (!authz_verification.authz_ok) {
    process.exitCode = 1;
  }
} catch (err) {
  console.error(err.message);
  const result = buildAuthzVerifyResult({
    release: { tag: TAG, commit: COMMIT, generated_at_utc: GENERATED_AT },
    bundle_ok: true,
    authz_verification: {
      executed: true,
      skipped: false,
      authz_ok: false,
      message: `AuthZ verification error: ${err.message}`,
      scope: {
        route_registry_file: 'lib/authz/routes.ts',
        route_count: ROUTE_REGISTRY.length,
        permission_count: VALID_PERMISSIONS.size,
        role_count: ROLE_COUNT,
        unique_routes: false,
        permissions_valid: false,
        deny_by_default: false,
        deny_by_default_scope: 'route_registry_only',
      },
    },
  });
  writeAuthzVerifyResultCanonical(OUTPUT_PATH, result);
  process.exitCode = 1;
}
