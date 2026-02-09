'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { KpiTiles, type KpiTile } from '@/components/dashboard/KpiTiles';
import { AlertsList } from '@/components/dashboard/AlertsList';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { AnchoringHealthCard } from '@/components/dashboard/AnchoringHealthCard';
import { AgentAssistant } from '@/components/dashboard/AgentAssistant';
import { useEffect, useState } from 'react';
import type { Alert } from '@/lib/alerts-service';

const KPI_ICON = {
  repair: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  ready: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  transit: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  ),
  spares: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  consumables: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>
  ),
};

export default function Home() {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    fetch('/api/alerts')
      .then((r) => r.json())
      .then((d) => setAlerts(d.alerts ?? []))
      .catch(() => setAlerts([]));
  }, []);

  const kpiTiles: KpiTile[] = [
    { label: 'В ремонте', value: 7, href: '/operations', query: { status: 'in_repair' }, icon: KPI_ICON.repair },
    { label: 'Готовы', value: 3, href: '/operations', query: { status: 'ready' }, icon: KPI_ICON.ready },
    { label: 'В пути', value: 2, href: '/operations', query: { status: 'in_transit' }, icon: KPI_ICON.transit },
    { label: 'Дефицит ЗИП', value: 4, href: '/operations', query: { view: 'materials', filter: 'shortage' }, icon: KPI_ICON.spares, variant: 'warning' },
    { label: 'Дефицит расходников', value: 2, href: '/operations', query: { view: 'consumables' }, icon: KPI_ICON.consumables, variant: 'warning' },
  ];

  return (
    <DashboardLayout>
      <main className="p-6 lg:p-8">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Дашборд</h2>

        <div className="mb-8">
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-4">KPI</h3>
          <KpiTiles tiles={kpiTiles} />
        </div>

        <div className="grid lg:grid-cols-3 gap-8 mb-8">
          <div className="lg:col-span-2">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-4">
              Предупреждения и сигналы
            </h3>
            <AlertsList alerts={alerts} />
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-4">
              Быстрые действия
            </h3>
            <QuickActions />
            <div className="mt-6">
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">
                Anchoring
              </h3>
              <AnchoringHealthCard />
            </div>
          </div>
        </div>

        <div className="mt-8">
          <AgentAssistant />
        </div>

        <div className="card mt-8">
          <div className="card-header py-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Последние события</h3>
          </div>
          <div className="card-body py-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              События по заявкам и операциям появятся здесь после интеграции с операционными данными.
            </p>
          </div>
        </div>
      </main>
    </DashboardLayout>
  );
}
