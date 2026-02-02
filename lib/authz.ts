/**
 * Policy / Authorization layer (US-2, v0.1.2).
 * Единая точка проверки прав. Использовать requirePermission() перед операциями.
 * Permission-first: endpoint проверяет permission, не роль. See docs/AUTHZ_MODEL.md.
 * v0.1.8: canWithAlias() for TMC.REQUEST.* / INSPECTION.* with legacy aliases.
 */
import { getDbReadOnly } from './db';
import type { Session } from 'next-auth';
import { Permissions, type Permission as Perm } from './authz/permissions';
import { hasPermissionWithAlias } from './authz/rbac-aliases';

export const PERMISSIONS = Permissions;
export type Permission = Perm;

/** Возвращает список permissions для роли. */
export function getPermissionsForRole(roleCode: string): Set<string> {
  const db = getDbReadOnly();
  const rows = db
    .prepare(
      'SELECT perm_code FROM rbac_role_permission WHERE role_code = ?'
    )
    .all(roleCode) as Array<{ perm_code: string }>;
  return new Set(rows.map((r) => r.perm_code));
}

/** Проверяет, имеет ли пользователь указанное разрешение (exact match). */
export function can(session: Session | null, permission: Permission): boolean {
  if (!session?.user?.id) return false;
  const roleCode = (session.user as { role?: string }).role;
  if (!roleCode) return false;
  const perms = getPermissionsForRole(roleCode);
  return perms.has(permission);
}

/** Alias for can() — checks if user has permission. */
export function hasPermission(session: Session | null, permission: Permission): boolean {
  return can(session, permission);
}

/** Проверяет permission с учётом aliases (TMC.REQUEST.*, TMC.VIEW, INSPECTION.*). */
export function canWithAlias(session: Session | null, permission: Perm): boolean {
  if (!session?.user?.id) return false;
  const roleCode = (session.user as { role?: string }).role;
  if (!roleCode) return false;
  const perms = getPermissionsForRole(roleCode);
  return hasPermissionWithAlias(perms, permission);
}

import { NextResponse } from 'next/server';
import { unauthorized, forbidden } from '@/lib/api/error-response';

/**
 * Обёртка для API route handler: требует permission, иначе возвращает 401/403.
 * Использовать: const err = requirePermission(session, PERMISSIONS.FILES_LIST, request);
 * if (err) return err;
 *
 * request — опционально; при наличии используется x-request-id для корреляции.
 */
export function requirePermission(
  session: Session | null,
  permission: Permission,
  request?: Request | null
): NextResponse | null {
  const headers = request?.headers;
  if (!session?.user?.id) {
    return unauthorized(headers);
  }
  if (!can(session, permission)) {
    return forbidden(headers);
  }
  return null;
}

/**
 * Требует permission с учётом aliases (TMC.REQUEST.*, TMC.VIEW, INSPECTION.*).
 * Использовать для TMC items/lots/requests и Inspection endpoints.
 */
export function requirePermissionWithAlias(
  session: Session | null,
  permission: Permission,
  request?: Request | null
): NextResponse | null {
  const headers = request?.headers;
  if (!session?.user?.id) {
    return unauthorized(headers);
  }
  if (!canWithAlias(session, permission)) {
    return forbidden(headers);
  }
  return null;
}
