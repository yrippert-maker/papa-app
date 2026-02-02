/**
 * AuthZ verification runner — same logic as API and bundle script.
 */
import { runAuthzVerification } from '@/lib/authz-verify-runner';

describe('authz-verify-runner', () => {
  it('returns authz_ok true when registry is valid', () => {
    const r = runAuthzVerification();
    expect(r.executed).toBe(true);
    expect(r.skipped).toBe(false);
    expect(r.authz_ok).toBe(true);
    expect(r.message).toBe('AuthZ verification passed');
  });

  it('scope contains expected fields', () => {
    const r = runAuthzVerification();
    expect(r.scope.route_registry_file).toBe('lib/authz/routes.ts');
    expect(r.scope.route_count).toBe(27);
    expect(r.scope.permission_count).toBe(15);
    expect(r.scope.role_count).toBe(5);
    expect(r.scope.unique_routes).toBe(true);
    expect(r.scope.permissions_valid).toBe(true);
    expect(r.scope.deny_by_default).toBe(true);
    expect(r.scope.deny_by_default_scope).toBe('route_registry_only');
  });
});
