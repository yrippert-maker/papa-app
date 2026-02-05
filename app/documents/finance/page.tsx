'use client';

import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DocumentsTabs } from '@/components/documents/DocumentsTabs';

export default function DocumentsFinancePage() {
  return (
    <DashboardLayout>
      <main className="p-6 lg:p-8">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Документы</h2>
        <DocumentsTabs />
        <h3 className="text-base font-medium text-slate-700 dark:text-slate-300 mb-6">Финансы — реестр платежей</h3>
        <p className="text-slate-500 dark:text-slate-400 mb-4">
          Единый реестр платежей обновляется после одобрения оператором в очереди почты (Accept + safe_auto или draft).
          См. <Link href="/mail/inbox" className="text-blue-600 dark:text-blue-400 hover:underline">Очередь почты</Link> и{' '}
          <code className="rounded bg-slate-100 px-1 dark:bg-slate-700">docs/plans/MAIL_MVP_SPEC.md</code> (A3, M2).
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Текущая версия реестра и история версий (Portal storage):{' '}
          <Link href="/documents/finance/payments" className="text-blue-600 dark:text-blue-400 hover:underline">
            Реестр платежей (finance/payments)
          </Link>
          . Changes pending (drafts) будут отображаться здесь.
        </p>
      </main>
    </DashboardLayout>
  );
}
