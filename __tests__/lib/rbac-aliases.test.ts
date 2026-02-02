/**
 * Unit tests for RBAC alias resolution (v0.1.8).
 */
import { hasPermissionWithAlias } from '@/lib/authz/rbac-aliases';
import { Permissions } from '@/lib/authz/permissions';

describe('hasPermissionWithAlias', () => {
  it('TMC.REQUEST.VIEW: direct permission grants access', () => {
    const perms = new Set(['TMC.REQUEST.VIEW']);
    expect(hasPermissionWithAlias(perms, Permissions.TMC_REQUEST_VIEW)).toBe(true);
  });

  it('TMC.REQUEST.VIEW: legacy TMC.VIEW grants access', () => {
    const perms = new Set(['TMC.VIEW']);
    expect(hasPermissionWithAlias(perms, Permissions.TMC_REQUEST_VIEW)).toBe(true);
  });

  it('TMC.REQUEST.VIEW: MANAGE implies VIEW', () => {
    const perms = new Set(['TMC.REQUEST.MANAGE']);
    expect(hasPermissionWithAlias(perms, Permissions.TMC_REQUEST_VIEW)).toBe(true);
  });

  it('TMC.REQUEST.VIEW: legacy TMC.MANAGE grants access', () => {
    const perms = new Set(['TMC.MANAGE']);
    expect(hasPermissionWithAlias(perms, Permissions.TMC_REQUEST_VIEW)).toBe(true);
  });

  it('TMC.REQUEST.VIEW: no matching permission denies access', () => {
    const perms = new Set(['WORKSPACE.READ', 'FILES.LIST']);
    expect(hasPermissionWithAlias(perms, Permissions.TMC_REQUEST_VIEW)).toBe(false);
  });

  it('TMC.REQUEST.MANAGE: direct permission grants access', () => {
    const perms = new Set(['TMC.REQUEST.MANAGE']);
    expect(hasPermissionWithAlias(perms, Permissions.TMC_REQUEST_MANAGE)).toBe(true);
  });

  it('TMC.REQUEST.MANAGE: legacy TMC.MANAGE grants access', () => {
    const perms = new Set(['TMC.MANAGE']);
    expect(hasPermissionWithAlias(perms, Permissions.TMC_REQUEST_MANAGE)).toBe(true);
  });

  it('TMC.REQUEST.MANAGE: VIEW only denies manage access', () => {
    const perms = new Set(['TMC.REQUEST.VIEW', 'TMC.VIEW']);
    expect(hasPermissionWithAlias(perms, Permissions.TMC_REQUEST_MANAGE)).toBe(false);
  });

  it('TMC.VIEW: TMC.MANAGE implies VIEW', () => {
    const perms = new Set(['TMC.MANAGE']);
    expect(hasPermissionWithAlias(perms, Permissions.TMC_VIEW)).toBe(true);
  });

  it('INSPECTION.VIEW: INSPECTION.MANAGE implies VIEW', () => {
    const perms = new Set(['INSPECTION.MANAGE']);
    expect(hasPermissionWithAlias(perms, Permissions.INSPECTION_VIEW)).toBe(true);
  });

  it('non-aliased permission: exact match only', () => {
    const perms = new Set(['WORKSPACE.READ']);
    expect(hasPermissionWithAlias(perms, Permissions.WORKSPACE_READ)).toBe(true);
    expect(hasPermissionWithAlias(perms, Permissions.FILES_LIST)).toBe(false);
  });
});
