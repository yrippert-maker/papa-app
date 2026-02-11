'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

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

  // Fix hydration: render date only on client via useEffect
  const [dateStr, setDateStr] = useState<string>('');

  useEffect(() => {
    setDateStr(formatDate(new Date()));
  }, []);

  return (
    <header className="h-16 flex items-center justify-between px-6 lg:px-7 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/95">
      {/* Left: Search */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 text-sm min-w-[280px] cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span>Поиск: SN / PN / Документ</span>
          <kbd className="ml-auto px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right: Date + Notifications + User */}
      <div className="flex items-center gap-4">
        {/* Date */}
        <span className="text-sm text-slate-500 dark:text-slate-400 font-mono tabular-nums">
          {dateStr}
        </span>

        {/* Notifications */}
        <button
          type="button"
          className="relative w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
        >
          <svg className="w-[18px] h-[18px] text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </button>

        {/* Separator */}
        <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />

        {/* User */}
        {user && (
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-red-400 flex items-center justify-center flex-shrink-0 shadow-sm shadow-primary/20">
              <span className="text-white text-sm font-bold uppercase">{initial}</span>
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate max-w-[140px]">
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
