'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { SafetyTable } from '@/components/safety/SafetyTable';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const MOCK_ROWS = [
  { id: 'F-01', type: 'Огнетушитель', serial: 'EXT-001', lastCheck: '2025-10-01', nextCheck: '2026-02-01', status: 'ok' },
  { id: 'F-02', type: 'Огнетушитель', serial: 'EXT-002', lastCheck: '2025-11-15', nextCheck: '2026-02-15', status: 'due_soon' },
];

function FireContent() {
  const searchParams = useSearchParams();
  const status = searchParams.get('status');
  const focusId = searchParams.get('focusId');

  return (
    <DashboardLayout>
      <main className="p-6 lg:p-8">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
          Пожарная безопасность
        </h2>
        <div className="mb-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Сводка: 8 средств | Просрочено: 0 | &lt;30 дней: 2 ⚠
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

export default function SafetyFirePage() {
  return (
    <Suspense fallback={<div className="p-6">Загрузка…</div>}>
      <FireContent />
    </Suspense>
  );
}
