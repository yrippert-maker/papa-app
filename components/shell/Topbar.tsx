'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Администратор',
  MANAGER: 'Менеджер',
  STOREKEEPER: 'Кладовщик',
  ENGINEER: 'Инженер',
  AUDITOR: 'Аудитор',
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function Topbar() {
  const { data: session } = useSession();
  const user = session?.user;
  const role = (user as { role?: string } | undefined)?.role;
  const initial = user?.name?.[0] ?? user?.email?.[0] ?? '?';

  return (
    <header className="h-16 flex items-center justify-between px-4 lg:px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80">
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
        >
          Поиск: SN / PN / Документ
        </Link>
        <span className="text-slate-300 dark:text-slate-600">|</span>
        <span className="text-sm text-slate-500 dark:text-slate-400 tabular-nums">
          {formatDate(new Date())}
        </span>
      </div>
      <div className="flex items-center gap-3">
        {user && (
          <div className="flex items-center gap-2 pl-4 border-l border-slate-200 dark:border-slate-700">
            <div className="w-8 h-8 rounded-full bg-slate-600 dark:bg-slate-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm font-medium uppercase">{initial}</span>
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-slate-900 dark:text-white truncate max-w-[140px]">
                {user.email}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {ROLE_LABELS[role ?? ''] ?? role}
              </p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
