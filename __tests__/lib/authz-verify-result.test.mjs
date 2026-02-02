/**
 * Unit tests for lib/authz-verify-result.mjs invariants.
 */
import { buildAuthzVerifyResult, AUTHZ_VERIFY_SCHEMA_VERSION } from '../../lib/authz-verify-result.mjs';

const release = { tag: 'v0.1.3', commit: 'abc123', generated_at_utc: '2026-02-01T12:00:00Z' };

describe('buildAuthzVerifyResult', () => {
  it('builds valid result when executed=true, authz_ok=true', () => {
    const r = buildAuthzVerifyResult({
      release,
      bundle_ok: true,
      authz_verification: {
        executed: true,
        skipped: false,
        authz_ok: true,
        message: 'AuthZ verification passed',
        scope: {
          route_registry_file: 'lib/authz/routes.ts',
          route_count: 17,
          permission_count: 13,
          role_count: 5,
          unique_routes: true,
          permissions_valid: true,
          deny_by_default: true,
          deny_by_default_scope: 'route_registry_only',
        },
      },
    });
    expect(r.schema_version).toBe(AUTHZ_VERIFY_SCHEMA_VERSION);
    expect(r.bundle_ok).toBe(true);
    expect(r.authz_verification.executed).toBe(true);
    expect(r.authz_verification.authz_ok).toBe(true);
    expect(r.authz_verification.scope.route_count).toBe(17);
  });

  it('builds valid result when skipped=true', () => {
    const r = buildAuthzVerifyResult({
      release,
      bundle_ok: true,
      authz_verification: {
        executed: false,
        skipped: true,
        authz_ok: null,
        message: 'Skipped',
        skip_reason: 'No route registry',
      },
    });
    expect(r.authz_verification.skipped).toBe(true);
    expect(r.authz_verification.authz_ok).toBeNull();
  });

  it('throws when skipped=true but executed=true', () => {
    expect(() =>
      buildAuthzVerifyResult({
        release,
        authz_verification: {
          executed: true,
          skipped: true,
          authz_ok: null,
          message: 'x',
          skip_reason: 'y',
        },
      })
    ).toThrow(/invariant failed/);
  });

  it('throws when executed=true but scope missing', () => {
    expect(() =>
      buildAuthzVerifyResult({
        release,
        authz_verification: {
          executed: true,
          skipped: false,
          authz_ok: true,
          message: 'ok',
        },
      })
    ).toThrow(/invariant failed/);
  });

  it('throws when release.generated_at_utc invalid', () => {
    expect(() =>
      buildAuthzVerifyResult({
        release: { ...release, generated_at_utc: 'invalid' },
        authz_verification: {
          executed: true,
          skipped: false,
          authz_ok: true,
          message: 'ok',
          scope: {
            route_registry_file: 'x',
            route_count: 0,
            permission_count: 0,
            role_count: 0,
            unique_routes: true,
            permissions_valid: true,
            deny_by_default: true,
            deny_by_default_scope: 'route_registry_only',
          },
        },
      })
    ).toThrow(/invariant failed/);
  });
});
