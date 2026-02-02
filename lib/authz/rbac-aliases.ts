/**
 * RBAC permission aliases for backward compatibility.
 * Legacy TMC_VIEW/TMC_MANAGE satisfy TMC.REQUEST.VIEW/MANAGE.
 * MANAGE implies VIEW for read-only checks.
 *
 * See docs/RBAC.md, docs/BACKLOG_v0.1.8.md.
 */
import type { Permission } from './permissions';

/** Permissions that satisfy TMC.REQUEST.VIEW (read). Includes legacy TMC.VIEW and MANAGE (implies VIEW). */
export const TMC_REQUEST_VIEW_ALIASES: readonly string[] = [
  'TMC.REQUEST.VIEW',
  'TMC.VIEW', // legacy
  'TMC.REQUEST.MANAGE', // MANAGE implies VIEW
  'TMC.MANAGE', // legacy
];

/** Permissions that satisfy TMC.REQUEST.MANAGE (write). Includes legacy TMC.MANAGE. */
export const TMC_REQUEST_MANAGE_ALIASES: readonly string[] = [
  'TMC.REQUEST.MANAGE',
  'TMC.MANAGE', // legacy
];

/** Permissions that satisfy TMC.VIEW (items/lots read). MANAGE implies VIEW. */
export const TMC_VIEW_ALIASES: readonly string[] = ['TMC.VIEW', 'TMC.MANAGE'];

/** Permissions that satisfy INSPECTION.VIEW. MANAGE implies VIEW. */
export const INSPECTION_VIEW_ALIASES: readonly string[] = [
  'INSPECTION.VIEW',
  'INSPECTION.MANAGE',
];

/** Permissions that satisfy INSPECTION.MANAGE. */
export const INSPECTION_MANAGE_ALIASES: readonly string[] = ['INSPECTION.MANAGE'];

/** Map: required permission → set of satisfying permissions (including aliases). */
const ALIAS_MAP: Record<string, readonly string[]> = {
  'TMC.REQUEST.VIEW': TMC_REQUEST_VIEW_ALIASES,
  'TMC.REQUEST.MANAGE': TMC_REQUEST_MANAGE_ALIASES,
  'TMC.VIEW': TMC_VIEW_ALIASES,
  'INSPECTION.VIEW': INSPECTION_VIEW_ALIASES,
  'INSPECTION.MANAGE': INSPECTION_MANAGE_ALIASES,
};

/**
 * Returns true if user has the required permission (direct or via alias).
 * For permissions not in ALIAS_MAP, falls back to exact match.
 */
export function hasPermissionWithAlias(
  userPermissions: Set<string>,
  required: Permission
): boolean {
  const aliases = ALIAS_MAP[required];
  if (aliases) {
    return aliases.some((p) => userPermissions.has(p));
  }
  return userPermissions.has(required);
}
