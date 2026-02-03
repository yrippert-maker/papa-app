/**
 * Nav config and filter for permission-first menu gating.
 * Used by Sidebar; tested by sidebar-nav.test.ts.
 *
 * Contract: All nav items MUST declare permission unless explicitly public.
 * - permission?: string — if absent (e.g. Dashboard), item is visible to all.
 * - permission present — visible only when session includes that permission.
 */

/** Permission code; undefined means public (visible to all). */
export type Permission = string | undefined;

export type NavItem = {
  href: string;
  label: string;
  /** Required for non-public items; undefined => visible to all. */
  permission?: Permission;
};

export type NavGroup = {
  label: string | null;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  { label: null, items: [{ href: '/', label: 'Дашборд' }] },
  {
    label: 'ТМЦ',
    items: [
      { href: '/tmc/registry', label: 'Остатки', permission: 'TMC.VIEW' },
      { href: '/tmc/lots', label: 'Лоты', permission: 'TMC.VIEW' },
    ],
  },
  {
    label: 'Заявки',
    items: [
      { href: '/tmc-requests/incoming', label: 'Входящие', permission: 'TMC.REQUEST.VIEW' },
      { href: '/tmc-requests/outgoing', label: 'Исходящие', permission: 'TMC.REQUEST.VIEW' },
    ],
  },
  {
    label: 'Контроль',
    items: [{ href: '/inspection', label: 'Техкарты', permission: 'INSPECTION.VIEW' }],
  },
  {
    label: 'Система',
    items: [
      { href: '/system/verify', label: 'Verify', permission: 'WORKSPACE.READ' },
      { href: '/system/health', label: 'Health', permission: 'WORKSPACE.READ' },
      { href: '/workspace', label: 'Workspace', permission: 'FILES.LIST' },
      { href: '/ai-inbox', label: 'AI Inbox', permission: 'AI_INBOX.VIEW' },
      { href: '/mail/inbox', label: 'Очередь почты', permission: 'COMPLIANCE.VIEW' },
      { href: '/governance/anchoring', label: 'Anchoring', permission: 'WORKSPACE.READ' },
      { href: '/admin/users', label: 'Пользователи', permission: 'ADMIN.MANAGE_USERS' },
    ],
  },
];

function hasPermission(permissions: string[], perm?: string): boolean {
  return !perm || permissions.includes(perm);
}

export function getVisibleNavItems(permissions: string[]): NavItem[] {
  const items: NavItem[] = [];
  for (const group of navGroups) {
    for (const item of group.items) {
      if (hasPermission(permissions, item.permission)) items.push(item);
    }
  }
  return items;
}

export function getVisibleNavGroups(permissions: string[]): NavGroup[] {
  return navGroups
    .map((g) => ({ ...g, items: g.items.filter((i) => hasPermission(permissions, i.permission)) }))
    .filter((g) => g.items.length > 0);
}
