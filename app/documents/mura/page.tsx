'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DocumentsTabs } from '@/components/documents/DocumentsTabs';

export default function DocumentsMuraPage() {
  return (
    <DashboardLayout>
      <main className="p-6 lg:p-8">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Документы</h2>
        <DocumentsTabs />
        <h3 className="text-base font-medium text-slate-700 dark:text-slate-300 mb-6">Mura Menasa</h3>
        <p className="text-slate-500 dark:text-slate-400">
          Документы Mura Menasa (QMS, СУБП, ТОиР). Текущая версия handbook в Portal storage:{' '}
          <Link href="/documents/mura-menasa/handbook" className="text-blue-600 dark:text-blue-400 hover:underline">
            Mura Menasa handbook
          </Link>
          .
        </p>
      </main>
    </DashboardLayout>
  );
}
