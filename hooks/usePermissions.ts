'use client';

import { useSession } from 'next-auth/react';
import { hasPermissionWithAlias } from '@/lib/authz/rbac-aliases';
import type { Permission } from '@/lib/authz';

/**
 * Client-side hook for permission checks.
 * Replaces 11+ duplicated patterns: const permissions = (session?.user as ...)?.permissions ?? []
 *
 * @returns { permissions, can, loading }
 * - permissions: string[] from session (or [])
 * - can(perm): boolean — checks permission (with aliases for TMC.REQUEST.*, INSPECTION.*)
 * - loading: boolean — session is loading
 */
export function usePermissions(): {
  permissions: string[];
  can: (perm: Permission) => boolean;
  loading: boolean;
} {
  const { data: session, status } = useSession();
  const loading = status === 'loading';

  const permissions =
    ((session?.user as { permissions?: string[] } | undefined)?.permissions ?? []) as string[];

  const can = (perm: Permission): boolean => {
    if (!session?.user) return false;
    return hasPermissionWithAlias(new Set(permissions), perm);
  };

  return { permissions, can, loading };
}
