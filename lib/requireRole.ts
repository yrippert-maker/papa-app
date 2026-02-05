/**
 * RBAC guard: проверка роли для server actions и API.
 * Использовать в дополнение к middleware (защита в глубину).
 */
import { NextResponse } from "next/server";
import { forbidden, unauthorized } from "@/lib/api/error-response";
import { logRbacAccessDeniedIfSampled } from "@/lib/rbac-audit";

export function requireRole(
  roles: string[],
  required: string | string[]
): void {
  const req = Array.isArray(required) ? required : [required];
  const normalized = roles.map((r) => r.toLowerCase());
  const hasRole = req.some((r) => normalized.includes(r.toLowerCase()));
  if (!hasRole) {
    throw new Error("FORBIDDEN");
  }
}

/**
 * API guard: требует одну из ролей. Возвращает NextResponse при ошибке.
 * Использование: const err = requireRoleForApi(session, ['admin'], req); if (err) return err;
 */
export function requireRoleForApi(
  session: { user?: { id?: string; roles?: string[] } } | null,
  required: string | string[],
  request?: Request | null
): NextResponse | null {
  const headers = request?.headers;
  if (!session?.user?.id) {
    return unauthorized(headers);
  }
  const roles = session.user.roles ?? [];
  const req = Array.isArray(required) ? required : [required];
  const normalized = roles.map((r) => r.toLowerCase());
  const hasRole = req.some((r) => normalized.includes(r.toLowerCase()));
  if (!hasRole) {
    logRbacAccessDeniedIfSampled({
      request: request ?? null,
      actorUserId: session.user.id,
      requiredRoles: req,
      path: request ? new URL(request.url).pathname : undefined,
    }).catch(() => {});
    return forbidden(headers);
  }
  return null;
}
