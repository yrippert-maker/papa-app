/**
 * Permission codes (normative). Must match rbac_permission.perm_code in DB.
 * See docs/AUTHZ_MODEL.md, docs/ENDPOINT_AUTHZ_EVIDENCE.md, docs/RBAC.md.
 */
export const Permissions = {
  WORKSPACE_READ: 'WORKSPACE.READ',
  FILES_LIST: 'FILES.LIST',
  FILES_UPLOAD: 'FILES.UPLOAD',
  AI_INBOX_VIEW: 'AI_INBOX.VIEW',
  LEDGER_READ: 'LEDGER.READ',
  LEDGER_APPEND: 'LEDGER.APPEND',
  ADMIN_MANAGE_USERS: 'ADMIN.MANAGE_USERS',
  TMC_VIEW: 'TMC.VIEW',
  TMC_MANAGE: 'TMC.MANAGE',
  TMC_REQUEST_VIEW: 'TMC.REQUEST.VIEW',
  TMC_REQUEST_MANAGE: 'TMC.REQUEST.MANAGE',
  INSPECTION_VIEW: 'INSPECTION.VIEW',
  INSPECTION_MANAGE: 'INSPECTION.MANAGE',
} as const;

export type Permission = (typeof Permissions)[keyof typeof Permissions];
