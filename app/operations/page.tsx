'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const ops = [
  { href: '/tmc-requests/incoming', label: 'Принять в ремонт', desc: 'Входной контроль, приём объекта' },
  { href: '/tmc-requests/outgoing', label: 'Выдать из ремонта', desc: 'Исходящая заявка' },
  { href: '/tmc-requests/incoming', label: 'Принять товар', desc: 'Поступление ТМЦ' },
];

function OperationsContent() {
  const searchParams = useSearchParams();
  const view = searchParams.get('view');
  const filter = searchParams.get('filter');

  return (
    <DashboardLayout>
      <main className="p-6 lg:p-8">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Операции</h2>
        {view === 'materials' && (
          <div className="mb-6 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Фильтр: материалы {filter === 'shortage' ? '(дефицит)' : ''}
            </p>
          </div>
        )}
        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          {ops.map((o) => (
            <Link
              key={o.href + o.label}
              href={o.href}
              className="card p-6 hover:shadow-md hover:border-blue-400 transition-all"
            >
              <h3 className="font-medium text-slate-900 dark:text-white">{o.label}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{o.desc}</p>
            </Link>
          ))}
        </div>
        <div className="card">
          <div className="card-header py-4">
            <h3 className="text-base font-semibold">Последние операции</h3>
          </div>
          <div className="card-body">
            <p className="text-slate-500 dark:text-slate-400">
              <Link href="/tmc-requests/incoming" className="text-blue-600 hover:underline">
                Входящие заявки
              </Link>
              ,{' '}
              <Link href="/tmc-requests/outgoing" className="text-blue-600 hover:underline">
                исходящие заявки
              </Link>
              .
            </p>
          </div>
        </div>
      </main>
    </DashboardLayout>
  );
}

export default function OperationsPage() {
  return (
    <Suspense fallback={<div className="p-6">Загрузка…</div>}>
      <OperationsContent />
    </Suspense>
  );
}
