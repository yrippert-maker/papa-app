/**
 * Policy / Authorization layer (US-2, v0.1.2).
 * Единая точка проверки прав. Использовать requirePermission() перед операциями.
 * Permission-first: endpoint проверяет permission, не роль. See docs/AUTHZ_MODEL.md.
 */
import { getDbReadOnly } from './db';
import type { Session } from 'next-auth';
import { Permissions, type Permission as Perm } from './authz/permissions';

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

/** Проверяет, имеет ли пользователь указанное разрешение. */
export function can(session: Session | null, permission: Permission): boolean {
  if (!session?.user?.id) return false;
  const roleCode = (session.user as { role?: string }).role;
  if (!roleCode) return false;
  const perms = getPermissionsForRole(roleCode);
  return perms.has(permission);
}

import { NextResponse } from 'next/server';

/**
 * Обёртка для API route handler: требует permission, иначе возвращает 401/403.
 * Использовать: const err = requirePermission(session, PERMISSIONS.FILES_LIST);
 * if (err) return err;
 */
export function requirePermission(
  session: Session | null,
  permission: Permission
): NextResponse | null {
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!can(session, permission)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}
