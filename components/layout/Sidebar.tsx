'use client';

import Image from 'next/image';
import { useSidebar } from '@/components/context/SidebarContext';
import { usePathname } from 'next/navigation';

const BRANDBOOK_LOGO = '/mura-menasa-logo.png';

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
        tooltip: 'Обзор: KPI, предупреждения, быстрые действия',
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        ),
      },
      {
        href: '/documents',
        label: 'Документы',
        tooltip: 'Регуляторы, Mura Menasa, архив',
        permission: undefined,
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        ),
      },
      {
        href: '/safety',
        label: 'Безопасность',
        tooltip: 'Подъёмные механизмы, пожарная',
        permission: 'INSPECTION.VIEW',
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        ),
      },
      {
        href: '/operations',
        label: 'Операции',
        tooltip: 'Принять в ремонт, принять товар, выдать',
        permission: undefined,
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        ),
      },
      {
        href: '/traceability',
        label: 'Эксплуатация',
        tooltip: 'Двигатель → вертолёт, прослеживаемость',
        permission: undefined,
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        ),
      },
    ],
  },
  {
    label: 'Админ',
    items: [
      {
        href: '/settings',
        label: 'Настройки',
        tooltip: 'Источники, доступ, режимы обновлений',
        permission: 'SETTINGS.VIEW',
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        ),
      },
      {
        href: '/compliance/decisions',
        label: 'История решений',
        tooltip: 'Decision History — решения верификации audit pack',
        permission: 'COMPLIANCE.VIEW',
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        ),
      },
      {
        href: '/system/health',
        label: 'Health',
        tooltip: 'Ledger, rollup, pending, observability',
        permission: 'WORKSPACE.READ',
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
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
    <a
      href={href}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 cursor-pointer text-[10px] font-medium ${className}`}
      title={title}
      aria-label={ariaLabel}
    >
      {children}
    </a>
  );
}

function StatusBadges({ collapsed, hasWorkspaceRead }: { collapsed: boolean; hasWorkspaceRead: boolean }) {
  const { status, unavailable } = useWorkspaceStatus();

  if (collapsed) return null;

  const wsOk = !unavailable && status?.workspaceExists;
  const ldgOk = !unavailable && status?.dbExists;

  return (
    <div className="px-2 py-2 mt-3 mx-2 rounded-xl bg-[#18181F] border border-[#2A2A35]">
      <div className="flex flex-wrap gap-1.5">
        <BadgeLink
          href="/workspace"
          className={wsOk
            ? 'bg-emerald-500/15 text-emerald-400'
            : 'bg-slate-700/50 text-slate-500'}
          title={wsOk ? 'Workspace инициализирован' : 'Workspace не найден'}
          aria-label={`Workspace: ${wsOk ? 'Активен' : 'Не найден'}. Перейти`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${wsOk ? 'bg-emerald-400' : 'bg-slate-500'}`} />
          {wsOk ? 'Workspace OK' : 'Workspace —'}
        </BadgeLink>
        <BadgeLink
          href="/system/verify"
          className={ldgOk
            ? 'bg-emerald-500/15 text-emerald-400'
            : 'bg-slate-700/50 text-slate-500'}
          title={ldgOk ? 'Ledger Active' : 'БД не найдена'}
          aria-label={`Ledger: ${ldgOk ? 'Active' : '—'}. Проверить`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${ldgOk ? 'bg-emerald-400' : 'bg-slate-500'}`} />
          {ldgOk
            ? ((status?.ledgerEvents ?? 0) > 0 ? 'Ledger Active' : 'Ledger Empty')
            : 'Ledger —'}
        </BadgeLink>
        {hasWorkspaceRead && (
          <BadgeLink
            href="/system/verify"
            className="bg-slate-700/50 text-slate-500"
            title="Проверка RBAC и Ledger"
            aria-label="AuthZ verify. Перейти"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
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
    <aside
      className={`fixed left-0 top-0 h-full overflow-hidden bg-[#0F0F12] border-r border-[#2A2A35] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] z-40 ${
        collapsed ? 'w-[72px]' : 'w-[260px]'
      }`}
    >
      {/* Logo — брендбук Mura Menasa / ПАПА */}
      <div className={`h-[72px] flex items-center ${collapsed ? 'px-4 justify-center' : 'px-5'} border-b border-[#2A2A35]`}>
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 flex-shrink-0 rounded-[10px] bg-gradient-to-br from-primary to-red-400 flex items-center justify-center shadow-lg shadow-primary/25">
              <Image
                src={BRANDBOOK_LOGO}
                alt="MURA MENASA FZCO"
                fill
                className="object-contain p-1"
                sizes="40px"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                  (e.currentTarget as HTMLImageElement).parentElement
                    ?.querySelector('.logo-fallback')
                    ?.classList.remove('hidden');
                }}
              />
              <div className="logo-fallback hidden absolute inset-0 rounded-[10px] bg-gradient-to-br from-primary to-red-400 flex items-center justify-center">
                <span className="text-white font-extrabold text-lg">П</span>
              </div>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-base text-white tracking-wide">ПАПА</span>
              <span className="text-[10px] text-slate-500 leading-tight">
                Mura Menasa FZCO
              </span>
            </div>
          </div>
        ) : (
          <div className="relative w-10 h-10 flex-shrink-0 rounded-[10px] bg-gradient-to-br from-primary to-red-400 flex items-center justify-center shadow-lg shadow-primary/25">
            <Image
              src={BRANDBOOK_LOGO}
              alt="MURA MENASA"
              fill
              className="object-contain p-1"
              sizes="40px"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
                (e.currentTarget as HTMLImageElement).parentElement
                  ?.querySelector('.logo-fallback')
                  ?.classList.remove('hidden');
              }}
            />
            <div className="logo-fallback hidden absolute inset-0 rounded-[10px] bg-gradient-to-br from-primary to-red-400 flex items-center justify-center">
              <span className="text-white font-extrabold text-lg">П</span>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 overflow-y-auto" aria-label="Главное меню">
        <div className="space-y-2 px-2">
          {navGroups.map((group) => {
            const items = group.items.filter((item) => hasPermission(item.permission));
            if (items.length === 0) return null;

            return (
              <div key={group.label ?? 'main'}>
                {group.label && !collapsed && (
                  <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                    {group.label}
                  </p>
                )}
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (item.href !== '/' && pathname?.startsWith(item.href));

                    return (
                      <a
                        key={item.href}
                        href={item.href}
                        title={item.tooltip}
                        aria-label={item.tooltip}
                        aria-current={isActive ? 'page' : undefined}
                        className={`group relative flex items-center gap-2.5 ${
                          collapsed ? 'px-0 justify-center' : 'px-3'
                        } py-2 rounded-lg text-[13px] font-medium transition-all duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F0F12] ${
                          isActive
                            ? 'bg-primary/10 text-primary'
                            : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'
                        }`}
                      >
                        {isActive && !collapsed && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
                        )}
                        <span className="flex-shrink-0 opacity-80">{item.icon}</span>
                        {!collapsed && <span>{item.label}</span>}
                      </a>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <StatusBadges
          collapsed={collapsed}
          hasWorkspaceRead={permissions.includes('WORKSPACE.READ')}
        />
      </nav>

      {/* Collapse + Sign out */}
      <div className="py-3 flex flex-col gap-0.5 px-2 border-t border-[#2A2A35]">
        <button
          onClick={toggle}
          className={`w-full flex items-center gap-2.5 ${
            collapsed ? 'justify-center px-0' : 'px-3'
          } py-2 text-[13px] text-slate-600 hover:text-slate-400 hover:bg-white/5 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
          title={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
          aria-label={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
        >
          <svg
            className={`w-5 h-5 transition-transform duration-300 ${collapsed ? '' : 'rotate-180'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
          </svg>
          {!collapsed && <span>Свернуть</span>}
        </button>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className={`w-full flex items-center gap-2.5 ${
            collapsed ? 'justify-center px-0' : 'px-3'
          } py-2 text-[13px] text-slate-600 hover:text-red-400 hover:bg-red-500/5 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
          title="Выйти из системы"
          aria-label="Выйти из системы"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {!collapsed && <span>Выйти</span>}
        </button>
      </div>
    </aside>
  );
}
