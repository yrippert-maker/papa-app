/**
 * Route registry export for verify-authz.mjs (runs without TypeScript).
 * MUST stay in sync with lib/authz/routes.ts — update both when adding routes.
 */
export const ROUTE_REGISTRY = [
  { method: 'GET', path: '/api/admin/users', permission: 'ADMIN.MANAGE_USERS' },
  { method: 'POST', path: '/api/admin/users', permission: 'ADMIN.MANAGE_USERS' },
  { method: 'PATCH', path: '/api/admin/users/:id', permission: 'ADMIN.MANAGE_USERS' },
  { method: 'GET', path: '/api/tmc/items', permission: 'TMC.MANAGE' },
  { method: 'GET', path: '/api/tmc/lots', permission: 'TMC.MANAGE' },
  { method: 'GET', path: '/api/tmc/requests', permission: 'TMC.REQUEST.VIEW' },
  { method: 'GET', path: '/api/files/list', permission: 'FILES.LIST' },
  { method: 'POST', path: '/api/files/upload', permission: 'FILES.UPLOAD' },
  { method: 'GET', path: '/api/workspace/status', permission: 'WORKSPACE.READ' },
  { method: 'POST', path: '/api/workspace/init', permission: 'WORKSPACE.READ' },
  { method: 'GET', path: '/api/ledger/verify', permission: 'LEDGER.READ' },
  { method: 'POST', path: '/api/ledger/append', permission: 'LEDGER.APPEND' },
];

export const VALID_PERMISSIONS = new Set([
  'WORKSPACE.READ', 'FILES.LIST', 'FILES.UPLOAD', 'LEDGER.READ', 'LEDGER.APPEND',
  'ADMIN.MANAGE_USERS', 'TMC.MANAGE', 'TMC.REQUEST.VIEW',
]);
