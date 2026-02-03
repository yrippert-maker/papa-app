'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/documents/regulators', label: 'Регуляторы' },
  { href: '/documents/mura', label: 'Mura Menasa' },
  { href: '/documents/archive', label: 'Архив' },
];

export default function DocumentsPage() {
  const pathname = usePathname();
  return (
    <DashboardLayout>
      <main className="p-6 lg:p-8">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Документы</h2>
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
        <p className="text-slate-500 dark:text-slate-400">
          <Link href="/documents/regulators" className="text-blue-600 dark:text-blue-400 hover:underline">
            Регуляторы
          </Link>
          {' — inbox изменений. '}
          <Link href="/documents/mura" className="text-blue-600 dark:text-blue-400 hover:underline">
            Mura Menasa
          </Link>
          {' — внутренние документы. '}
          <Link href="/documents/archive" className="text-blue-600 dark:text-blue-400 hover:underline">
            Архив
          </Link>
          .
        </p>
      </main>
    </DashboardLayout>
  );
}
