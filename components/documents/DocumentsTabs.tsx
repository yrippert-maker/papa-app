'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/documents/library', label: 'Библиотека' },
  { href: '/documents/regulators', label: 'Регуляторы' },
  { href: '/documents/finance', label: 'Финансы' },
  { href: '/documents/mura', label: 'Mura Menasa' },
  { href: '/documents/archive', label: 'Архив' },
];

export function DocumentsTabs() {
  const pathname = usePathname();
  return (
    <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 mb-6">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg -mb-px ${
            pathname === t.href
              ? 'bg-white dark:bg-slate-800 border border-b-0 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
