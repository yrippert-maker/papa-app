/**
 * Получить роли пользователя из Prisma (UserRole).
 * Используется в NextAuth callbacks для заполнения session.roles.
 */
import { prisma } from "@/lib/prisma";

export async function getUserRoles(userId: string): Promise<string[]> {
  const rows = await prisma.userRole.findMany({
    where: { userId },
    include: { role: true },
  });
  return rows.map((r) => r.role.name);
}
