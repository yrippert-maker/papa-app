'use client';

import Link from 'next/link';
import { useSidebar } from '@/components/context/SidebarContext';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useWorkspaceStatus } from '@/hooks/useWorkspaceStatus';

type NavItem = {
  href: string;
  label: string;
  tooltip: string;
  icon: React.ReactNode;
  permission?: string;
};

type NavGroup = {
  label: string | null;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: null,
    items: [
      {
        href: '/',
        label: 'Дашборд',
        tooltip: 'Обзор системы: статус, метрики, быстрые действия',
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        ),
      },
    ],
  },
  {
    label: 'ТМЦ',
    items: [
      {
        href: '/tmc/registry',
        label: 'Остатки',
        tooltip: 'Реестр номенклатуры и текущие остатки',
        permission: 'TMC.VIEW',
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        ),
      },
      {
        href: '/tmc/lots',
        label: 'Лоты',
        tooltip: 'Партии материалов, учёт по лотам',
        permission: 'TMC.VIEW',
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        ),
      },
    ],
  },
  {
    label: 'Заявки',
    items: [
      {
        href: '/tmc-requests/incoming',
        label: 'Входящие',
        tooltip: 'Заявки на поступление ТМЦ',
        permission: 'TMC.REQUEST.VIEW',
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
          </svg>
        ),
      },
      {
        href: '/tmc-requests/outgoing',
        label: 'Исходящие',
        tooltip: 'Заявки на выдачу ТМЦ',
        permission: 'TMC.REQUEST.VIEW',
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        ),
      },
    ],
  },
  {
    label: 'Контроль',
    items: [
      {
        href: '/inspection',
        label: 'Техкарты',
        tooltip: 'Входной и выходной контроль ТМЦ',
        permission: 'INSPECTION.VIEW',
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        ),
      },
    ],
  },
  {
    label: 'Compliance',
    items: [
      {
        href: '/compliance/keys',
        label: 'Ключи',
        tooltip: 'Управление ключами подписи Evidence',
        permission: 'COMPLIANCE.VIEW',
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        ),
      },
      {
        href: '/compliance/verify',
        label: 'Статистика',
        tooltip: 'Метрики верификации Evidence',
        permission: 'COMPLIANCE.VIEW',
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        ),
      },
      {
        href: '/inspection/verify',
        label: 'Проверить',
        tooltip: 'Проверить Evidence export',
        permission: 'INSPECTION.VIEW',
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        ),
      },
      {
        href: '/compliance/retention',
        label: 'Retention',
        tooltip: 'Политики хранения данных',
        permission: 'COMPLIANCE.VIEW',
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
      {
        href: '/compliance/requests',
        label: 'Запросы',
        tooltip: '2-man rule approval flow',
        permission: 'COMPLIANCE.VIEW',
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
      {
        href: '/compliance/snapshots',
        label: 'Snapshots',
        tooltip: 'Audit snapshots для внешнего аудита',
        permission: 'COMPLIANCE.VIEW',
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        ),
      },
    ],
  },
  {
    label: 'Система',
    items: [
      {
        href: '/system/verify',
        label: 'Verify',
        tooltip: 'Run AuthZ and safety checks',
        permission: 'WORKSPACE.READ',
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        ),
      },
      {
        href: '/workspace',
        label: 'Workspace',
        tooltip: 'Файловая структура проекта',
        permission: 'FILES.LIST',
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        ),
      },
      {
        href: '/ai-inbox',
        label: 'AI Inbox',
        tooltip: 'Просмотр и загрузка документов',
        permission: 'AI_INBOX.VIEW',
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        ),
      },
      {
        href: '/admin/users',
        label: 'Пользователи',
        tooltip: 'Управление пользователями и ролями',
        permission: 'ADMIN.MANAGE_USERS',
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        ),
      },
    ],
  },
];

function BadgeLink({
  href,
  className,
  title,
  'aria-label': ariaLabel,
  children,
}: {
  href: string;
  className: string;
  title: string;
  'aria-label': string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${className}`}
      title={title}
      aria-label={ariaLabel}
    >
      {children}
    </Link>
  );
}

function StatusBadges({ collapsed, hasWorkspaceRead }: { collapsed: boolean; hasWorkspaceRead: boolean }) {
  const { status, unavailable } = useWorkspaceStatus();

  if (collapsed) return null;

  const wsClass = unavailable
    ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
    : status?.workspaceExists
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400'
      : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400';
  const ldgClass = unavailable
    ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
    : status?.dbExists
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400'
      : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400';
  const authzClass = 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400';

  return (
    <div className="px-3 py-2 mt-2 mx-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
      <div className="flex flex-wrap gap-2 text-xs">
        <BadgeLink
          href="/workspace"
          className={wsClass}
          title={unavailable ? 'Недоступно' : status?.workspaceExists ? 'Workspace инициализирован' : 'Workspace не найден'}
          aria-label={unavailable ? 'Статус Workspace недоступен' : `Workspace: ${status?.workspaceExists ? 'Активен' : 'Не найден'}. Перейти`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          {unavailable ? 'Workspace —' : status?.workspaceExists ? 'Workspace OK' : 'Workspace —'}
        </BadgeLink>
        <BadgeLink
          href="/system/verify"
          className={ldgClass}
          title={unavailable ? 'Недоступно' : status?.dbExists ? `Ledger: ${(status?.ledgerEvents ?? 0) > 0 ? 'Active' : 'Empty'}` : 'БД не найдена'}
          aria-label={unavailable ? 'Статус Ledger недоступен' : `Ledger: ${status?.dbExists ? ((status?.ledgerEvents ?? 0) > 0 ? 'Active' : 'Empty') : '—'}. Проверить`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          {unavailable ? 'Ledger —' : status?.dbExists ? ((status?.ledgerEvents ?? 0) > 0 ? 'Ledger Active' : 'Ledger Empty') : 'Ledger —'}
        </BadgeLink>
        {hasWorkspaceRead && (
          <BadgeLink
            href="/system/verify"
            className={authzClass}
            title="Проверка RBAC и Ledger"
            aria-label="AuthZ verify. Перейти"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            AuthZ
          </BadgeLink>
        )}
      </div>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();
  const { data: session } = useSession();
  const permissions = (session?.user as { permissions?: string[] } | undefined)?.permissions ?? [];

  const hasPermission = (perm?: string) => !perm || permissions.includes(perm);

  return (
    <aside className={`fixed left-0 top-0 h-full bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 transition-all duration-300 z-40 ${collapsed ? 'w-20' : 'w-64'}`}>
      {/* Logo - ПАПА */}
      <div className="h-20 flex items-center px-6 border-b border-slate-200 dark:border-slate-700">
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-700 dark:bg-slate-600 flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-lg">П</span>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg text-slate-900 dark:text-white">ПАПА</span>
              <span className="text-xs text-slate-500 dark:text-slate-400 leading-tight">Программа автоматизации<br />производственной аналитики</span>
            </div>
          </div>
        ) : (
          <div className="w-10 h-10 rounded-lg bg-slate-700 dark:bg-slate-600 flex items-center justify-center mx-auto shadow-sm">
            <span className="text-white font-bold text-lg">П</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto" aria-label="Главное меню">
        <div className="space-y-4 px-3">
          {navGroups.map((group) => {
            const items = group.items.filter((item) => hasPermission(item.permission));
            if (items.length === 0) return null;
            return (
              <div key={group.label ?? 'main'}>
                {group.label && !collapsed && (
                  <p className="px-3 mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {group.label}
                  </p>
                )}
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={item.tooltip}
                        aria-label={item.tooltip}
                        aria-current={isActive ? 'page' : undefined}
                        className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
                          focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-800
                          ${isActive
                            ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
                          }`}
                      >
                        <span className="flex-shrink-0 opacity-90">{item.icon}</span>
                        {!collapsed && <span>{item.label}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <StatusBadges collapsed={collapsed} hasWorkspaceRead={permissions.includes('WORKSPACE.READ')} />
      </nav>

      {/* Collapse + Sign out */}
      <div className="h-auto py-4 flex flex-col gap-1 px-6 border-t border-slate-200 dark:border-slate-700">
        <button
          onClick={toggle}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          title={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
          aria-label={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={collapsed ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"} />
          </svg>
          {!collapsed && <span>Свернуть</span>}
        </button>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          title="Выйти из системы"
          aria-label="Выйти из системы"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {!collapsed && <span>Выйти</span>}
        </button>
      </div>
    </aside>
  );
}
