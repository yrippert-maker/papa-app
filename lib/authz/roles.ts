/**
 * Role codes (normative). Must match rbac_role.role_code in DB.
 * See docs/AUTHZ_MODEL.md.
 */
export const Roles = {
  ADMIN: 'ADMIN',
  AUDITOR: 'AUDITOR',
  MANAGER: 'MANAGER',
  STOREKEEPER: 'STOREKEEPER',
  ENGINEER: 'ENGINEER',
} as const;

export type Role = (typeof Roles)[keyof typeof Roles];
