/**
 * Unit-тесты для lib/authz — policy layer.
 */
jest.mock('@/lib/db', () => {
  const mockDb = () => ({
    prepare: (_sql: string) => ({
      all: (roleCode: string) => {
        const perms: Record<string, Array<{ perm_code: string }>> = {
          AUDITOR: [
            { perm_code: 'WORKSPACE.READ' },
            { perm_code: 'FILES.LIST' },
            { perm_code: 'LEDGER.READ' },
            { perm_code: 'TMC.VIEW' },
          ],
          ADMIN: [
            { perm_code: 'WORKSPACE.READ' },
            { perm_code: 'FILES.LIST' },
            { perm_code: 'FILES.UPLOAD' },
            { perm_code: 'LEDGER.READ' },
            { perm_code: 'LEDGER.APPEND' },
            { perm_code: 'ADMIN.MANAGE_USERS' },
          ],
          ENGINEER: [
            { perm_code: 'WORKSPACE.READ' },
            { perm_code: 'FILES.LIST' },
            { perm_code: 'LEDGER.READ' },
            { perm_code: 'TMC.VIEW' },
            { perm_code: 'TMC.REQUEST.VIEW' },
          ],
        };
        return perms[roleCode] ?? [];
      },
    }),
  });
  return { getDb: mockDb, getDbReadOnly: mockDb };
});

import { getPermissionsForRole, requirePermission, requirePermissionWithAlias, can, canWithAlias, PERMISSIONS } from '@/lib/authz';
import type { Session } from 'next-auth';

describe('getPermissionsForRole', () => {
  it('returns only read permissions for AUDITOR', () => {
    const perms = getPermissionsForRole('AUDITOR');
    expect(perms.has('WORKSPACE.READ')).toBe(true);
    expect(perms.has('FILES.LIST')).toBe(true);
    expect(perms.has('LEDGER.READ')).toBe(true);
    expect(perms.has('FILES.UPLOAD')).toBe(false);
    expect(perms.has('LEDGER.APPEND')).toBe(false);
  });

  it('returns full permissions for ADMIN', () => {
    const perms = getPermissionsForRole('ADMIN');
    expect(perms.has('FILES.UPLOAD')).toBe(true);
    expect(perms.has('LEDGER.APPEND')).toBe(true);
  });
});

describe('requirePermission', () => {
  it('returns 401 when session is null', () => {
    const res = requirePermission(null, PERMISSIONS.WORKSPACE_READ);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
  });

  it('returns 401 with standardized payload (code, message, request_id)', async () => {
    const res = requirePermission(null, PERMISSIONS.WORKSPACE_READ);
    expect(res).not.toBeNull();
    const body = await res!.json();
    expect(body).toMatchObject({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    expect(typeof body.error.request_id).toBe('string');
    expect(body.error.request_id.length).toBeGreaterThan(0);
  });

  it('returns 401 when session has no user id', () => {
    const session = { user: { name: 'x' }, expires: '' } as Session;
    const res = requirePermission(session, PERMISSIONS.WORKSPACE_READ);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
  });

  it('returns 403 when user has no permission (AUDITOR on FILES.UPLOAD)', () => {
    const session = {
      user: { id: '1', role: 'AUDITOR' },
      expires: '',
    } as Session;
    const res = requirePermission(session, PERMISSIONS.FILES_UPLOAD);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
  });

  it('returns 403 with standardized payload (code, message, request_id)', async () => {
    const session = {
      user: { id: '1', role: 'AUDITOR' },
      expires: '',
    } as Session;
    const res = requirePermission(session, PERMISSIONS.FILES_UPLOAD);
    expect(res).not.toBeNull();
    const body = await res!.json();
    expect(body).toMatchObject({ error: { code: 'FORBIDDEN', message: 'Forbidden' } });
    expect(typeof body.error.request_id).toBe('string');
    expect(body.error.request_id.length).toBeGreaterThan(0);
  });

  it('returns null (pass) when user has permission', () => {
    const session = {
      user: { id: '1', role: 'ADMIN' },
      expires: '',
    } as Session;
    const res = requirePermission(session, PERMISSIONS.FILES_UPLOAD);
    expect(res).toBeNull();
  });

  it('returns null for AUDITOR on WORKSPACE.READ', () => {
    const session = {
      user: { id: '2', role: 'AUDITOR' },
      expires: '',
    } as Session;
    const res = requirePermission(session, PERMISSIONS.WORKSPACE_READ);
    expect(res).toBeNull();
  });
});

describe('can', () => {
  it('returns false for null session', () => {
    expect(can(null, PERMISSIONS.WORKSPACE_READ)).toBe(false);
  });

  it('returns false when role has no permission', () => {
    const session = { user: { id: '1', role: 'AUDITOR' }, expires: '' } as Session;
    expect(can(session, PERMISSIONS.LEDGER_APPEND)).toBe(false);
  });

  it('returns true when role has permission', () => {
    const session = { user: { id: '1', role: 'AUDITOR' }, expires: '' } as Session;
    expect(can(session, PERMISSIONS.FILES_LIST)).toBe(true);
  });
});

describe('canWithAlias', () => {
  it('AUDITOR with TMC.VIEW has TMC.REQUEST.VIEW via alias', () => {
    const session = { user: { id: '1', role: 'AUDITOR' }, expires: '' } as Session;
    expect(canWithAlias(session, PERMISSIONS.TMC_REQUEST_VIEW)).toBe(true);
  });

  it('ENGINEER with TMC.REQUEST.VIEW has TMC.REQUEST.VIEW', () => {
    const session = { user: { id: '1', role: 'ENGINEER' }, expires: '' } as Session;
    expect(canWithAlias(session, PERMISSIONS.TMC_REQUEST_VIEW)).toBe(true);
  });

  it('AUDITOR without TMC.REQUEST.MANAGE denied for manage', () => {
    const session = { user: { id: '1', role: 'AUDITOR' }, expires: '' } as Session;
    expect(canWithAlias(session, PERMISSIONS.TMC_REQUEST_MANAGE)).toBe(false);
  });
});

describe('requirePermissionWithAlias', () => {
  it('returns null for AUDITOR on TMC.REQUEST.VIEW (via TMC.VIEW alias)', () => {
    const session = { user: { id: '1', role: 'AUDITOR' }, expires: '' } as Session;
    const res = requirePermissionWithAlias(session, PERMISSIONS.TMC_REQUEST_VIEW);
    expect(res).toBeNull();
  });

  it('returns 403 for role without any TMC permission', () => {
    const session = { user: { id: '1', role: 'ADMIN' }, expires: '' } as Session;
    const res = requirePermissionWithAlias(session, PERMISSIONS.TMC_REQUEST_VIEW);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
  });

  it('returns 403 with standardized payload (code, message, request_id)', async () => {
    const session = { user: { id: '1', role: 'ADMIN' }, expires: '' } as Session;
    const res = requirePermissionWithAlias(session, PERMISSIONS.TMC_REQUEST_VIEW);
    expect(res).not.toBeNull();
    const body = await res!.json();
    expect(body).toMatchObject({ error: { code: 'FORBIDDEN', message: 'Forbidden' } });
    expect(typeof body.error.request_id).toBe('string');
    expect(body.error.request_id.length).toBeGreaterThan(0);
  });
});
