'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type TmcRequest = {
  tmc_request_id: string;
  request_no: string | null;
  title: string | null;
  status: string;
  request_category: string;
  created_at: string;
  line_count: number;
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Черновик',
  SUBMITTED: 'На рассмотрении',
  APPROVED: 'Согласована',
  REJECTED: 'Отклонена',
  IN_PROGRESS: 'В работе',
  COMPLETED: 'Выполнена',
  CANCELLED: 'Отменена',
};

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'badge-secondary',
  SUBMITTED: 'badge-warning',
  APPROVED: 'badge-success',
  REJECTED: 'badge-error',
  IN_PROGRESS: 'badge-primary',
  COMPLETED: 'badge-success',
  CANCELLED: 'badge-secondary',
};

const CATEGORY_LABELS: Record<string, string> = {
  TECH_CARD: 'По техкарте',
  PURCHASE: 'Закупка',
  TRANSFER: 'Перемещение',
  OTHER: 'Прочее',
};

export default function OutgoingRequestsPage() {
  const [requests, setRequests] = useState<TmcRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/tmc/requests?kind=OUTGOING')
      .then((r) => r.json())
      .then((data) => setRequests(data.requests ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardLayout>
      <PageHeader
        title="Исходящие заявки"
        subtitle="Выдача ТМЦ со склада"
        breadcrumbs={['Заявки']}
        actions={
          <Link href="/tmc-requests/outgoing/new" className="btn btn-primary">
            + Новая заявка
          </Link>
        }
      />

      <main className="flex-1 p-6 lg:p-7">
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Список заявок</h3>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-mono font-medium text-slate-500">
                {requests.length}
              </span>
            </div>
          </div>

          <div className="card-body overflow-x-auto !p-0">
            {loading ? (
              <div className="p-6">
                <p className="text-slate-500 dark:text-slate-400">Загрузка...</p>
              </div>
            ) : requests.length === 0 ? (
              <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                <p>Нет исходящих заявок.</p>
                <Link href="/tmc-requests/outgoing/new" className="btn btn-primary mt-4 inline-block">
                  Создать заявку
                </Link>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>№</th>
                    <th>Название</th>
                    <th>Категория</th>
                    <th>Статус</th>
                    <th className="text-right">Позиций</th>
                    <th>Создана</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.tmc_request_id}>
                      <td className="font-mono text-xs font-medium text-primary">
                        {r.request_no ?? r.tmc_request_id.slice(0, 8)}
                      </td>
                      <td className="font-medium text-slate-900 dark:text-white">{r.title ?? '—'}</td>
                      <td className="text-slate-600 dark:text-slate-300">
                        {CATEGORY_LABELS[r.request_category] ?? r.request_category}
                      </td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[r.status] ?? 'badge-secondary'}`}>
                          {STATUS_LABELS[r.status] ?? r.status}
                        </span>
                      </td>
                      <td className="text-right font-mono text-slate-500">{r.line_count}</td>
                      <td className="font-mono text-xs text-slate-500">
                        {new Date(r.created_at).toLocaleDateString('ru-RU')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </DashboardLayout>
  );
}
