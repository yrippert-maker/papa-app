'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { SafetyTable } from '@/components/safety/SafetyTable';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const MOCK_ROWS = [
  { id: 'L-01', type: 'Кран', serial: 'CR-001', lastCheck: '2025-09-01', nextCheck: '2026-03-01', status: 'ok' },
  { id: 'L-02', type: 'Таль', serial: 'TL-002', lastCheck: '2025-08-15', nextCheck: '2026-02-15', status: 'due_soon' },
];

function LiftingContent() {
  const searchParams = useSearchParams();
  const status = searchParams.get('status');
  const focusId = searchParams.get('focusId');

  return (
    <DashboardLayout>
      <main className="p-6 lg:p-8">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
          Подъёмные механизмы
        </h2>
        <div className="mb-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Сводка: 12 единиц | Просрочено: 0 | &lt;30 дней: 1 ⚠
          </p>
        </div>
        <SafetyTable
          rows={MOCK_ROWS}
          columns={['id', 'type', 'serial', 'lastCheck', 'nextCheck', 'status']}
          focusId={focusId ?? undefined}
          filterStatus={status ?? undefined}
        />
      </main>
    </DashboardLayout>
  );
}

export default function SafetyLiftingPage() {
  return (
    <Suspense fallback={<div className="p-6">Загрузка…</div>}>
      <LiftingContent />
    </Suspense>
  );
}
