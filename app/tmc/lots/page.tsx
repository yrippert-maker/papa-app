'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useEffect, useState } from 'react';

type TmcLot = {
  tmc_lot_id: string;
  lot_no: string | null;
  serial_no: string | null;
  qty_on_hand: number;
  location: string | null;
  status: string;
  item_name: string;
  item_code: string | null;
  unit: string;
};

const STATUS_LABELS: Record<string, string> = {
  ON_HAND: 'На складе',
  RESERVED: 'Зарезервирован',
  ISSUED: 'Выдан',
  QUARANTINE: 'Карантин',
  SCRAPPED: 'Списан',
};

const STATUS_BADGE: Record<string, string> = {
  ON_HAND: 'badge-success',
  RESERVED: 'badge-warning',
  ISSUED: 'badge-secondary',
  QUARANTINE: 'badge-error',
  SCRAPPED: 'badge-secondary',
};

export default function TmcLotsPage() {
  const [lots, setLots] = useState<TmcLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    const url = statusFilter
      ? `/api/tmc/lots?status=${statusFilter}`
      : '/api/tmc/lots';

    fetch(url)
      .then((r) => r.json())
      .then((data) => setLots(data.lots ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [statusFilter]);

  return (
    <DashboardLayout>
      <PageHeader
        title="ТМЦ — Лоты"
        subtitle="Учёт партий и серийных номеров"
        breadcrumbs={['ТМЦ']}
      />

      <main className="flex-1 p-6 lg:p-7">
        <div className="card mb-6">
          <div className="card-body !py-4">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Статус:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input max-w-[200px] !py-2"
              >
                <option value="">Все</option>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Партии</h3>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-mono font-medium text-slate-500">
                {lots.length}
              </span>
            </div>
          </div>

          <div className="card-body overflow-x-auto !p-0">
            {loading ? (
              <div className="p-6">
                <p className="text-slate-500 dark:text-slate-400">Загрузка...</p>
              </div>
            ) : lots.length === 0 ? (
              <div className="p-6">
                <p className="text-slate-500 dark:text-slate-400">Нет данных.</p>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Партия / Серия</th>
                    <th>Наименование</th>
                    <th>Код</th>
                    <th className="text-right">Кол-во</th>
                    <th>Ед.</th>
                    <th>Место хранения</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {lots.map((l) => (
                    <tr key={l.tmc_lot_id}>
                      <td className="font-mono text-xs font-medium text-primary">
                        {l.lot_no ?? l.serial_no ?? l.tmc_lot_id.slice(0, 8)}
                      </td>
                      <td className="font-medium text-slate-900 dark:text-white">{l.item_name}</td>
                      <td className="font-mono text-xs text-slate-500">{l.item_code ?? '—'}</td>
                      <td className="text-right font-mono font-medium">{Number(l.qty_on_hand).toFixed(2)}</td>
                      <td className="text-slate-400 text-xs">{l.unit}</td>
                      <td className="text-slate-600 dark:text-slate-300">{l.location ?? '—'}</td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[l.status] ?? 'badge-secondary'}`}>
                          {STATUS_LABELS[l.status] ?? l.status}
                        </span>
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
