'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DocumentsTabs } from '@/components/documents/DocumentsTabs';
import { DocumentLibraryFull } from '@/components/documents/DocumentLibraryFull';
import { RegulatoryLibrary } from '@/components/documents/RegulatoryLibrary';
import { useState } from 'react';
import { Suspense } from 'react';

export default function DocumentsLibraryPage() {
  const [view, setView] = useState<'sidebar' | 'api'>('sidebar');

  return (
    <DashboardLayout>
      <main className="p-6 lg:p-8">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Документы</h2>
        <DocumentsTabs />
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <h3 className="text-base font-medium text-slate-700 dark:text-slate-300">
            Библиотека документов — Mura Menasa, ICAO, EASA, FAA, АрМАК, GCAA
          </h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setView('sidebar')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                view === 'sidebar' ? 'bg-slate-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-600'
              }`}
            >
              Оглавление
            </button>
            <button
              type="button"
              onClick={() => setView('api')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                view === 'api' ? 'bg-slate-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-600'
              }`}
            >
              Карточки + PDF
            </button>
          </div>
        </div>
        <Suspense fallback={<div className="p-6">Загрузка…</div>}>
          {view === 'sidebar' ? <DocumentLibraryFull /> : <RegulatoryLibrary />}
        </Suspense>
      </main>
    </DashboardLayout>
  );
}
