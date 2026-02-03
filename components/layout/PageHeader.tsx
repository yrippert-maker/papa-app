'use client';

import { useSession } from 'next-auth/react';

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  /** Показать пользователя справа (по умолчанию — да для дашборда) */
  showUser?: boolean;
  /** Дополнительные действия справа */
  actions?: React.ReactNode;
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Администратор',
  MANAGER: 'Менеджер',
  STOREKEEPER: 'Кладовщик',
  ENGINEER: 'Инженер',
  AUDITOR: 'Аудитор',
};

export function PageHeader({ title, subtitle, showUser = true, actions }: PageHeaderProps) {
  const { data: session } = useSession();
  const user = session?.user;
  const role = (user as { role?: string } | undefined)?.role;
  const initial = user?.name?.[0] ?? user?.email?.[0] ?? '?';

  return (
    <header className="bg-white dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {actions}
            {showUser && user && (
              <div className="flex items-center gap-2 pl-4 border-l border-slate-200 dark:border-slate-700">
                <div className="w-8 h-8 rounded-full bg-slate-600 dark:bg-slate-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-sm font-medium uppercase">{initial}</span>
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate max-w-[120px]">
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
