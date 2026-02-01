/**
 * Route registry for deny-by-default enforcement.
 * Every protected API route MUST be listed here with its required permission.
 * CI test asserts: no route without permission; registry matches actual routes.
 * See docs/ENDPOINT_AUTHZ_EVIDENCE.md.
 */
import { Permissions, type Permission } from './permissions';

export type RouteSpec = {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  permission: Permission;
};

export const routeRegistry: RouteSpec[] = [
  { method: 'GET', path: '/api/admin/users', permission: Permissions.ADMIN_MANAGE_USERS },
  { method: 'POST', path: '/api/admin/users', permission: Permissions.ADMIN_MANAGE_USERS },
  { method: 'PATCH', path: '/api/admin/users/:id', permission: Permissions.ADMIN_MANAGE_USERS },
  { method: 'GET', path: '/api/tmc/items', permission: Permissions.TMC_MANAGE },
  { method: 'GET', path: '/api/tmc/lots', permission: Permissions.TMC_MANAGE },
  { method: 'GET', path: '/api/tmc/requests', permission: Permissions.TMC_REQUEST_VIEW },
  { method: 'GET', path: '/api/files/list', permission: Permissions.FILES_LIST },
  { method: 'POST', path: '/api/files/upload', permission: Permissions.FILES_UPLOAD },
  { method: 'GET', path: '/api/workspace/status', permission: Permissions.WORKSPACE_READ },
  { method: 'POST', path: '/api/workspace/init', permission: Permissions.WORKSPACE_READ },
  { method: 'GET', path: '/api/ledger/verify', permission: Permissions.LEDGER_READ },
  { method: 'POST', path: '/api/ledger/append', permission: Permissions.LEDGER_APPEND },
];
