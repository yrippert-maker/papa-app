'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DocumentsTabs } from '@/components/documents/DocumentsTabs';

export default function DocumentsArchivePage() {
  return (
    <DashboardLayout>
      <main className="p-6 lg:p-8">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Документы</h2>
        <DocumentsTabs />
        <h3 className="text-base font-medium text-slate-700 dark:text-slate-300 mb-6">Архив</h3>
        <p className="text-slate-500 dark:text-slate-400">
          Архив обработанных документов и изменений.
        </p>
      </main>
    </DashboardLayout>
  );
}
