/**
 * Menu RBAC gating: verify getVisibleNavItems and getVisibleNavGroups filter by permission.
 * Protects against regressions when changing nav or permission logic.
 */
import { getVisibleNavItems, getVisibleNavGroups, navGroups } from '@/lib/sidebar-nav';

describe('sidebar-nav RBAC gating', () => {
  it('hides Пользователи without ADMIN.MANAGE_USERS', () => {
    const auditorPerms = ['WORKSPACE.READ', 'FILES.LIST', 'LEDGER.READ'];
    const visible = getVisibleNavItems(auditorPerms);
    const users = visible.find((i) => i.href === '/admin/users');
    expect(users).toBeUndefined();
  });

  it('shows Пользователи with ADMIN.MANAGE_USERS', () => {
    const adminPerms = ['WORKSPACE.READ', 'FILES.LIST', 'FILES.UPLOAD', 'LEDGER.READ', 'ADMIN.MANAGE_USERS', 'TMC.MANAGE', 'TMC.REQUEST.VIEW'];
    const visible = getVisibleNavItems(adminPerms);
    const users = visible.find((i) => i.href === '/admin/users');
    expect(users).toBeDefined();
    expect(users?.label).toBe('Пользователи');
  });

  it('shows Dashboard to all (no permission required)', () => {
    const visible = getVisibleNavItems([]);
    const dash = visible.find((i) => i.href === '/');
    expect(dash).toBeDefined();
  });

  it('hides TMC without TMC.VIEW', () => {
    const perms = ['WORKSPACE.READ', 'FILES.LIST'];
    const visible = getVisibleNavItems(perms);
    const tmc = visible.filter((i) => i.href.startsWith('/tmc/'));
    expect(tmc).toHaveLength(0);
  });

  it('shows Verify with WORKSPACE.READ', () => {
    const perms = ['WORKSPACE.READ'];
    const visible = getVisibleNavItems(perms);
    const verify = visible.find((i) => i.href === '/system/verify');
    expect(verify).toBeDefined();
  });

  it('shows TMC with TMC.VIEW', () => {
    const perms = ['TMC.VIEW'];
    const visible = getVisibleNavItems(perms);
    const tmc = visible.filter((i) => i.href.startsWith('/tmc/'));
    expect(tmc).toHaveLength(2);
  });

  it('shows AI Inbox with AI_INBOX.VIEW', () => {
    const perms = ['AI_INBOX.VIEW'];
    const visible = getVisibleNavItems(perms);
    const inbox = visible.find((i) => i.href === '/ai-inbox');
    expect(inbox).toBeDefined();
  });

  it('shows Workspace with FILES.LIST', () => {
    const perms = ['FILES.LIST'];
    const visible = getVisibleNavItems(perms);
    const ws = visible.find((i) => i.href === '/workspace');
    expect(ws).toBeDefined();
  });

  it('hides AI Inbox without AI_INBOX.VIEW', () => {
    const perms = ['FILES.LIST'];
    const visible = getVisibleNavItems(perms);
    const inbox = visible.find((i) => i.href === '/ai-inbox');
    expect(inbox).toBeUndefined();
  });

  it('navGroups structure matches expected item count', () => {
    const total = navGroups.reduce((sum, g) => sum + g.items.length, 0);
    expect(total).toBe(9);
  });

  it('getVisibleNavGroups hides groups with no visible items', () => {
    const perms: string[] = [];
    const groups = getVisibleNavGroups(perms);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBeNull();
    expect(groups[0].items).toHaveLength(1);
    expect(groups[0].items[0].href).toBe('/');
  });
});
