/**
 * RBAC invariants: allowed roles, default role, prevent 0 admins.
 * Использовать при создании/изменении пользователей и ролей.
 */
import { prisma } from "@/lib/prisma";

export const ALLOWED_ROLES = ["admin", "user", "auditor"] as const;
export const DEFAULT_ROLE = "user";

/** Проверить, что имя роли допустимо. */
export function isAllowedRole(name: string): boolean {
  return ALLOWED_ROLES.includes(name.toLowerCase() as (typeof ALLOWED_ROLES)[number]);
}

/** Назначить default role пользователю, если у него нет ролей. */
export async function ensureDefaultRole(userId: string): Promise<void> {
  const count = await prisma.userRole.count({ where: { userId } });
  if (count > 0) return;

  const userRole = await prisma.role.findUnique({ where: { name: DEFAULT_ROLE } });
  if (!userRole) return;

  await prisma.userRole.create({
    data: { userId, roleId: userRole.id },
  });
}

/** Проверить: нельзя снять admin с последнего администратора. */
export async function preventLastAdminDemotion(userId: string): Promise<void> {
  const adminRole = await prisma.role.findUnique({ where: { name: "admin" } });
  if (!adminRole) return;

  const admins = await prisma.userRole.count({
    where: { roleId: adminRole.id },
  });
  if (admins <= 1) {
    const isTargetAdmin = await prisma.userRole.findUnique({
      where: { userId_roleId: { userId, roleId: adminRole.id } },
    });
    if (isTargetAdmin) {
      throw new Error("CANNOT_DEMOTE_LAST_ADMIN");
    }
  }
}
