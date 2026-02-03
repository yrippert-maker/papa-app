'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DocumentsTabs } from '@/components/documents/DocumentsTabs';
import { RegulatorInbox } from '@/components/documents/RegulatorInbox';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function RegulatorsContent() {
  const searchParams = useSearchParams();
  const focusId = searchParams.get('focusId') ?? undefined;
  const status = searchParams.get('status') ?? undefined;

  return (
    <DashboardLayout>
      <main className="p-6 lg:p-8">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Документы</h2>
        <DocumentsTabs />
        <h3 className="text-base font-medium text-slate-700 dark:text-slate-300 mb-4">Регуляторы — Inbox</h3>
        <RegulatorInbox focusId={focusId} initialStatus={status ?? undefined} />
      </main>
    </DashboardLayout>
  );
}

export default function DocumentsRegulatorsPage() {
  return (
    <Suspense fallback={<div className="p-6">Загрузка…</div>}>
      <RegulatorsContent />
    </Suspense>
  );
}
