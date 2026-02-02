/**
 * Route registry export for verify-authz.mjs (runs without TypeScript).
 * MUST stay in sync with lib/authz/routes.ts — update both when adding routes.
 */
export const ROUTE_REGISTRY = [
  { method: 'GET', path: '/api/admin/users', permission: 'ADMIN.MANAGE_USERS' },
  { method: 'POST', path: '/api/admin/users', permission: 'ADMIN.MANAGE_USERS' },
  { method: 'PATCH', path: '/api/admin/users/:id', permission: 'ADMIN.MANAGE_USERS' },
  { method: 'GET', path: '/api/tmc/items', permission: 'TMC.REQUEST.VIEW' },
  { method: 'GET', path: '/api/tmc/lots', permission: 'TMC.REQUEST.VIEW' },
  { method: 'GET', path: '/api/tmc/requests', permission: 'TMC.REQUEST.VIEW' },
  { method: 'GET', path: '/api/inspection/cards', permission: 'INSPECTION.VIEW' },
  { method: 'GET', path: '/api/inspection/cards/:id', permission: 'INSPECTION.VIEW' },
  { method: 'POST', path: '/api/inspection/cards/:id/transition', permission: 'INSPECTION.MANAGE' },
  { method: 'GET', path: '/api/files/list', permission: 'FILES.LIST' },
  { method: 'GET', path: '/api/ai-inbox', permission: 'AI_INBOX.VIEW' },
  { method: 'POST', path: '/api/files/upload', permission: 'FILES.UPLOAD' },
  { method: 'GET', path: '/api/workspace/status', permission: 'WORKSPACE.READ' },
  { method: 'POST', path: '/api/workspace/init', permission: 'WORKSPACE.READ' },
  { method: 'GET', path: '/api/ledger/verify', permission: 'LEDGER.READ' },
  { method: 'POST', path: '/api/ledger/append', permission: 'LEDGER.APPEND' },
  { method: 'GET', path: '/api/authz/verify', permission: 'WORKSPACE.READ' },
  { method: 'GET', path: '/api/system/verify', permission: 'WORKSPACE.READ' },
];

export const VALID_PERMISSIONS = new Set([
  'WORKSPACE.READ', 'FILES.LIST', 'FILES.UPLOAD', 'AI_INBOX.VIEW', 'LEDGER.READ', 'LEDGER.APPEND',
  'ADMIN.MANAGE_USERS', 'TMC.VIEW', 'TMC.MANAGE', 'TMC.REQUEST.VIEW', 'TMC.REQUEST.MANAGE',
  'INSPECTION.VIEW', 'INSPECTION.MANAGE',
]);

/** Normative role count per AUTHZ_MODEL (ADMIN, AUDITOR, MANAGER, STOREKEEPER, ENGINEER). */
export const ROLE_COUNT = 5;
