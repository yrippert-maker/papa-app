'use client';

import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DocumentsTabs } from '@/components/documents/DocumentsTabs';

export default function DocumentsMuraPage() {
  return (
    <DashboardLayout>
      <main className="p-6 lg:p-8">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Документы</h2>
        <DocumentsTabs />
        <h3 className="text-base font-medium text-slate-700 dark:text-slate-300 mb-6">Mura Menasa</h3>
        <div className="space-y-4">
          <p className="text-slate-500 dark:text-slate-400">
            Документы Mura Menasa (QMS, СУБП, ТОиР). Текущая версия handbook в Portal storage:{' '}
            <Link href="/documents/mura-menasa/handbook" className="text-blue-600 dark:text-blue-400 hover:underline">
              Mura Menasa handbook
            </Link>
            .
          </p>
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-800/30">
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Эталоны (ТВ3-117, АИ-9, НР-3)</h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
              Эталонные документы на основе ИКАО, EASA, АРМАК и Mura Menasa. Генерация через{' '}
              <Link href="/" className="text-blue-600 dark:text-blue-400 hover:underline">Помощник по документам</Link>.
            </p>
            <span className="text-sm font-mono">docs/mura-menasa/etolony/</span>
            {' — реестр, матрица соответствия, глоссарий. Runbook: ETOLONY_RUNBOOK.md'}
          </div>
        </div>
      </main>
    </DashboardLayout>
  );
}
