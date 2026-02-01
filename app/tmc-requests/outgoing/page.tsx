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
        actions={
          <Link href="/tmc-requests/outgoing/new" className="btn btn-primary">
            + Новая заявка
          </Link>
        }
      />
      <main className="flex-1 p-6 lg:p-8">
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-[#0F172A]">Список заявок</h3>
          </div>
          <div className="card-body overflow-x-auto">
            {loading ? (
              <p className="text-[#64748B]">Загрузка...</p>
            ) : requests.length === 0 ? (
              <div className="text-center py-12 text-[#64748B]">
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
                    <th>Позиций</th>
                    <th>Создана</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.tmc_request_id}>
                      <td className="font-mono">{r.request_no ?? r.tmc_request_id.slice(0, 8)}</td>
                      <td className="font-medium">{r.title ?? '—'}</td>
                      <td>{CATEGORY_LABELS[r.request_category] ?? r.request_category}</td>
                      <td>
                        <span className="badge badge-secondary">
                          {STATUS_LABELS[r.status] ?? r.status}
                        </span>
                      </td>
                      <td>{r.line_count}</td>
                      <td>{new Date(r.created_at).toLocaleDateString('ru-RU')}</td>
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
