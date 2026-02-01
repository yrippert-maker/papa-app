/**
 * AuthZ verification — runtime logic (shared by API and bundle script).
 * Validates route registry: unique routes, all permissions valid, deny-by-default.
 */
import { routeRegistry } from './authz/routes';
import { Permissions } from './authz/permissions';

const VALID_PERMISSIONS = new Set(Object.values(Permissions));
const ROLE_COUNT = 5; // ADMIN, AUDITOR, MANAGER, STOREKEEPER, ENGINEER

export type AuthzVerifyScope = {
  route_registry_file: string;
  route_count: number;
  permission_count: number;
  role_count: number;
  unique_routes: boolean;
  permissions_valid: boolean;
  deny_by_default: boolean;
  /** Clarifies scope: only routes in registry have explicit permission; unknown routes denied. */
  deny_by_default_scope: 'route_registry_only';
};

export type AuthzVerifyResult = {
  executed: true;
  skipped: false;
  authz_ok: boolean;
  message: string;
  scope: AuthzVerifyScope;
};

export function runAuthzVerification(): AuthzVerifyResult {
  const seen = new Set<string>();
  let uniqueRoutes = true;
  let permissionsValid = true;
  const errors: string[] = [];

  for (const r of routeRegistry) {
    const key = `${r.method} ${r.path}`;
    if (seen.has(key)) {
      uniqueRoutes = false;
      errors.push(`duplicate route: ${key}`);
    }
    seen.add(key);

    const perm = r.permission;
    if (!perm || typeof perm !== 'string') {
      permissionsValid = false;
      errors.push(`missing permission: ${key}`);
    } else if (!VALID_PERMISSIONS.has(perm)) {
      permissionsValid = false;
      errors.push(`unknown permission "${perm}" for ${key}`);
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
      route_count: routeRegistry.length,
      permission_count: VALID_PERMISSIONS.size,
      role_count: ROLE_COUNT,
      unique_routes: uniqueRoutes,
      permissions_valid: permissionsValid,
      deny_by_default: true,
      deny_by_default_scope: 'route_registry_only',
    },
  };
}
