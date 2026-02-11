'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatePanel } from '@/components/ui/StatePanel';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

const INSPECTION_VIEW_PERMS = ['INSPECTION.VIEW', 'INSPECTION.MANAGE'];

type InspectionCard = {
  inspection_card_id: string;
  card_no: string;
  card_kind: string;
  status: string;
  request_no: string | null;
  request_title: string | null;
  created_at: string;
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Черновик',
  IN_PROGRESS: 'В работе',
  COMPLETED: 'Завершена',
  CANCELLED: 'Отменена',
};

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'badge-secondary',
  IN_PROGRESS: 'badge-primary',
  COMPLETED: 'badge-success',
  CANCELLED: 'badge-secondary',
};

const KIND_LABELS: Record<string, string> = {
  INPUT: 'Входной контроль',
  OUTPUT: 'Выходной контроль',
};

type ReportSummary = {
  total_cards: number;
  by_status: Record<string, number>;
  completion_rate_pct: number;
  fail_rate_pct: number;
  breakdown_by_check_code: Record<string, { PASS: number; FAIL: number; NA: number }>;
};

export default function InspectionListPage() {
  const { data: session, status } = useSession();
  const [cards, setCards] = useState<InspectionCard[]>([]);
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const permissions =
    (session?.user as { permissions?: string[] } | undefined)?.permissions ?? [];
  const hasInspectionView = INSPECTION_VIEW_PERMS.some((p) => permissions.includes(p));

  useEffect(() => {
    if (status === 'loading') return;
    if (!hasInspectionView) {
      setForbidden(true);
      setLoading(false);
      return;
    }

    Promise.all([
      fetch('/api/inspection/cards').then((r) => {
        if (r.status === 403) { setForbidden(true); return { cards: [] }; }
        return r.json();
      }),
      fetch('/api/inspection/report').then((r) => {
        if (r.status === 403) return null;
        return r.json();
      }),
    ])
      .then(([cardsData, reportData]) => {
        setCards(cardsData.cards ?? []);
        setReport(reportData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [status, hasInspectionView]);

  if (status === 'loading' || (hasInspectionView && loading && !forbidden)) {
    return (
      <DashboardLayout>
        <PageHeader title="Техкарты контроля" subtitle="Входной и выходной контроль ТМЦ" breadcrumbs={['Контроль']} />
        <main className="flex-1 p-6 lg:p-7">
          <StatePanel variant="loading" title="Загрузка..." />
        </main>
      </DashboardLayout>
    );
  }

  if (forbidden || !hasInspectionView) {
    return (
      <DashboardLayout>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="card max-w-md w-full text-center">
            <div className="card-body">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Доступ запрещён</h2>
              <p className="text-slate-500 dark:text-slate-400 mb-4">
                У вас нет прав для просмотра техкарт контроля (требуется INSPECTION.VIEW).
              </p>
              <Link href="/" className="btn btn-primary">
                На главную
              </Link>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const failTotal = report
    ? Object.values(report.breakdown_by_check_code ?? {}).reduce((s, b) => s + (b.FAIL ?? 0), 0)
    : 0;

  return (
    <DashboardLayout>
      <PageHeader
        title="Техкарты контроля"
        subtitle="Входной и выходной контроль ТМЦ"
        breadcrumbs={['Контроль']}
        actions={
          <Link href="/inspection/verify" className="btn btn-outline btn-sm">
            🔍 Проверить Evidence
          </Link>
        }
      />

      <main className="flex-1 p-6 lg:p-7 space-y-6">
        {report && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-4">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Всего карт</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{report.total_cards}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Завершено</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{report.completion_rate_pct}%</p>
            </div>
            <div className="card p-4">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Не пройдено (FAIL)</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{report.fail_rate_pct}%</p>
            </div>
            <div className="card p-4">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Результатов FAIL</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{failTotal}</p>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-header flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Список техкарт</h3>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-mono font-medium text-slate-500">
                {cards.length}
              </span>
            </div>
          </div>

          <div className="card-body overflow-x-auto !p-0">
            {loading ? (
              <div className="p-6">
                <p className="text-slate-500 dark:text-slate-400">Загрузка...</p>
              </div>
            ) : cards.length === 0 ? (
              <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                <p>Нет техкарт контроля.</p>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>№ карты</th>
                    <th>Тип</th>
                    <th>Заявка</th>
                    <th>Статус</th>
                    <th>Создана</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {cards.map((c) => (
                    <tr key={c.inspection_card_id}>
                      <td className="font-mono text-xs font-medium text-primary">{c.card_no}</td>
                      <td className="text-slate-600 dark:text-slate-300">{KIND_LABELS[c.card_kind] ?? c.card_kind}</td>
                      <td className="text-slate-600 dark:text-slate-300">{c.request_no ?? c.request_title ?? '—'}</td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[c.status] ?? 'badge-secondary'}`}>
                          {STATUS_LABELS[c.status] ?? c.status}
                        </span>
                      </td>
                      <td className="font-mono text-xs text-slate-500">
                        {new Date(c.created_at).toLocaleDateString('ru-RU')}
                      </td>
                      <td>
                        <Link
                          href={`/inspection/${c.inspection_card_id}`}
                          className="btn btn-ghost btn-sm"
                        >
                          Открыть
                        </Link>
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
