/**
 * Policy / Authorization layer (US-2, v0.1.2).
 * Единая точка проверки прав. Использовать requirePermission() перед операциями.
 * Permission-first: endpoint проверяет permission, не роль. See docs/AUTHZ_MODEL.md.
 * v0.1.8: canWithAlias() for TMC.REQUEST.* / INSPECTION.* with legacy aliases.
 */
import { getDbReadOnly, dbAll } from './db';
import type { Session } from 'next-auth';
import { Permissions, type Permission as Perm } from './authz/permissions';
import { hasPermissionWithAlias } from './authz/rbac-aliases';

export const PERMISSIONS = Permissions;
export type Permission = Perm;

/** Возвращает список permissions для роли. */
export async function getPermissionsForRole(roleCode: string): Promise<Set<string>> {
  try {
    const db = await getDbReadOnly();
    // Нормализация: admin → ADMIN (RBAC в БД хранит uppercase)
    const code = roleCode?.toUpperCase() ?? '';
    const rows = (await dbAll(db, 'SELECT perm_code FROM rbac_role_permission WHERE role_code = ?', code)) as Array<{ perm_code: string }>;
    return new Set(rows.map((r) => r.perm_code));
  } catch (e) {
    console.warn('[authz] getPermissionsForRole failed:', e);
    return new Set();
  }
}

/** Проверяет, имеет ли пользователь указанное разрешение (exact match). */
export async function can(session: Session | null, permission: Permission): Promise<boolean> {
  if (!session?.user?.id) return false;
  const user = session.user as { role?: string; permissions?: string[] };
  // Приоритет: permissions из JWT (session), иначе — из БД
  if (user.permissions && user.permissions.length > 0) {
    return user.permissions.includes(permission);
  }
  const roleCode = user.role;
  if (!roleCode) return false;
  const perms = await getPermissionsForRole(roleCode);
  return perms.has(permission);
}

/** Alias for can() — checks if user has permission. */
export async function hasPermission(session: Session | null, permission: Permission): Promise<boolean> {
  return can(session, permission);
}

/** Проверяет permission с учётом aliases (TMC.REQUEST.*, TMC.VIEW, INSPECTION.*). */
export async function canWithAlias(session: Session | null, permission: Perm): Promise<boolean> {
  if (!session?.user?.id) return false;
  const user = session.user as { role?: string; permissions?: string[] };
  // Приоритет: permissions из JWT (session), иначе — из БД
  if (user.permissions && user.permissions.length > 0) {
    return hasPermissionWithAlias(new Set(user.permissions), permission);
  }
  const roleCode = user.role;
  if (!roleCode) return false;
  const perms = await getPermissionsForRole(roleCode);
  return hasPermissionWithAlias(perms, permission);
}

import { NextResponse } from 'next/server';
import { unauthorized, forbidden } from '@/lib/api/error-response';
import { logRbacAccessDeniedIfSampled } from '@/lib/rbac-audit';

/**
 * Обёртка для API route handler: требует permission, иначе возвращает 401/403.
 * Использовать: const err = await requirePermission(session, PERMISSIONS.FILES_LIST, request);
 * if (err) return err;
 *
 * request — опционально; при наличии используется x-request-id для корреляции.
 */
export async function requirePermission(
  session: Session | null,
  permission: Permission,
  request?: Request | null
): Promise<NextResponse | null> {
  const headers = request?.headers;
  if (!session?.user?.id) {
    return unauthorized(headers);
  }
  if (!(await can(session, permission))) {
    logRbacAccessDeniedIfSampled({
      request: request ?? null,
      actorUserId: session.user.id,
      permission,
      path: request ? new URL(request.url).pathname : undefined,
    }).catch(() => {});
    return forbidden(headers);
  }
  return null;
}

/**
 * Требует permission с учётом aliases (TMC.REQUEST.*, TMC.VIEW, INSPECTION.*).
 * Использовать для TMC items/lots/requests и Inspection endpoints.
 */
export async function requirePermissionWithAlias(
  session: Session | null,
  permission: Permission,
  request?: Request | null
): Promise<NextResponse | null> {
  const headers = request?.headers;
  if (!session?.user?.id) {
    return unauthorized(headers);
  }
  if (!(await canWithAlias(session, permission))) {
    logRbacAccessDeniedIfSampled({
      request: request ?? null,
      actorUserId: session.user.id,
      permission,
      path: request ? new URL(request.url).pathname : undefined,
    }).catch(() => {});
    return forbidden(headers);
  }
  return null;
}
