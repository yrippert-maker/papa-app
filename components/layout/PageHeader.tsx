'use client';

import { useSession } from 'next-auth/react';

type PageHeaderProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  subtitle?: string;
  /** Показать пользователя справа (по умолчанию — да для дашборда) */
  showUser?: boolean;
  /** Дополнительные действия справа */
  actions?: React.ReactNode;
  /** Хлебные крошки: ['ТМЦ', 'Остатки'] */
  breadcrumbs?: string[];
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Администратор',
  MANAGER: 'Менеджер',
  STOREKEEPER: 'Кладовщик',
  ENGINEER: 'Инженер',
  AUDITOR: 'Аудитор',
};

export function PageHeader({ title, description, subtitle, showUser = true, actions, breadcrumbs }: PageHeaderProps) {
  const { data: session } = useSession();
  const user = session?.user;
  const role = (user as { role?: string } | undefined)?.role;
  const initial = user?.name?.[0] ?? user?.email?.[0] ?? '?';

  return (
    <header className="bg-white dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800">
      <div className="px-6 lg:px-7 py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            {/* Breadcrumbs */}
            {breadcrumbs && breadcrumbs.length > 0 && (
              <div className="flex items-center gap-1.5 mb-1">
                {breadcrumbs.map((crumb, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400 dark:text-slate-500">{crumb}</span>
                    {i < breadcrumbs.length - 1 && (
                      <span className="text-xs text-slate-300 dark:text-slate-600">/</span>
                    )}
                  </span>
                ))}
              </div>
            )}
            <h1 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {title}
            </h1>
            {(description ?? subtitle) && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{description ?? subtitle}</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {actions}

            {showUser && user && (
              <div className="flex items-center gap-2.5 pl-4 border-l border-slate-200 dark:border-slate-700">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-red-400 flex items-center justify-center flex-shrink-0 shadow-sm shadow-primary/20">
                  <span className="text-white text-sm font-bold uppercase">{initial}</span>
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate max-w-[120px]">
                    {user.email}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {ROLE_LABELS[role ?? ''] ?? role}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
