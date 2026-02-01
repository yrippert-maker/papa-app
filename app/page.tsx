'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useEffect, useState } from 'react';

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
  }).format(date);
}

export default function Home() {
  const [currentDate] = useState(new Date());
  const [workspaceStatus, setWorkspaceStatus] = useState<{
    workspaceExists: boolean;
    dbExists: boolean;
    filesRegistered: number;
    ledgerEvents: number;
  } | null>(null);

  useEffect(() => {
    fetch('/api/workspace/status')
      .then((r) => r.json())
      .then(setWorkspaceStatus)
      .catch(console.error);
  }, []);

  return (
    <DashboardLayout>
      <PageHeader
        title="Дашборд"
        subtitle={formatDate(currentDate)}
      />

      <main className="flex-1 p-6 lg:p-8">
        {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6 mb-8">
            <div className="card hover:shadow-md transition-shadow">
              <div className="card-body py-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Файлов в системе</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{workspaceStatus?.filesRegistered ?? 0}</p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
            <div className="card hover:shadow-md transition-shadow">
              <div className="card-body py-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Событий в Ledger</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{workspaceStatus?.ledgerEvents ?? 0}</p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
            <div className="card hover:shadow-md transition-shadow">
              <div className="card-body py-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Workspace</p>
                    <p className={`text-sm font-medium ${workspaceStatus?.workspaceExists ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      {workspaceStatus?.workspaceExists ? 'Активен' : 'Не найден'}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
            <div className="card hover:shadow-md transition-shadow">
              <div className="card-body py-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">База данных</p>
                    <p className={`text-sm font-medium ${workspaceStatus?.dbExists ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      {workspaceStatus?.dbExists ? 'Подключена' : 'Не найдена'}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>

        {/* Quick Actions — фокус на задачах */}
          <div className="card mb-8">
            <div className="card-header py-4">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Быстрые действия</h3>
            </div>
            <div className="card-body pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <a
                  href="/tmc-requests/incoming"
                  className="group p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-all"
                >
                  <h4 className="font-medium text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 mb-1">
                    Входящая заявка
                  </h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Поступление ТМЦ</p>
                </a>
                <a
                  href="/tmc-requests/outgoing"
                  className="group p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-all"
                >
                  <h4 className="font-medium text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 mb-1">
                    Исходящая заявка
                  </h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Выдача ТМЦ</p>
                </a>
                <a
                  href="/ai-inbox"
                  className="group p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-all"
                >
                  <h4 className="font-medium text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 mb-1">
                    Загрузить документ
                  </h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400">AI Inbox</p>
                </a>
              </div>
            </div>
          </div>

          {/* System Status — компактно */}
          <div className="card">
            <div className="card-header py-4">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Статус системы</h3>
            </div>
            <div className="card-body py-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Workspace</span>
                  <span className={`text-sm font-medium ${workspaceStatus?.workspaceExists ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {workspaceStatus?.workspaceExists ? 'Ок' : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500 dark:text-slate-400">БД</span>
                  <span className={`text-sm font-medium ${workspaceStatus?.dbExists ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {workspaceStatus?.dbExists ? 'Ок' : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Файлов</span>
                  <span className="text-sm font-medium text-slate-900 dark:text-white tabular-nums">{workspaceStatus?.filesRegistered ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Ledger</span>
                  <span className="text-sm font-medium text-slate-900 dark:text-white tabular-nums">{workspaceStatus?.ledgerEvents ?? 0}</span>
                </div>
              </div>
            </div>
          </div>
        </main>
    </DashboardLayout>
  );
}
