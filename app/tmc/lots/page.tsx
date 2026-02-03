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

export default function TmcLotsPage() {
  const [lots, setLots] = useState<TmcLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    const url = statusFilter ? `/api/tmc/lots?status=${statusFilter}` : '/api/tmc/lots';
    fetch(url)
      .then((r) => r.json())
      .then((data) => setLots(data.lots ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [statusFilter]);

  return (
    <DashboardLayout>
      <PageHeader title="ТМЦ — Лоты" subtitle="Учёт партий и серийных номеров" />
      <main className="flex-1 p-6 lg:p-8">
        <div className="card mb-6">
          <div className="card-body">
            <label className="label">Фильтр по статусу</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input max-w-xs"
            >
              <option value="">Все</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-[#0F172A]">Партии</h3>
          </div>
          <div className="card-body overflow-x-auto">
            {loading ? (
              <p className="text-[#64748B]">Загрузка...</p>
            ) : lots.length === 0 ? (
              <p className="text-[#64748B]">Нет данных.</p>
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
                      <td>{l.lot_no ?? l.serial_no ?? l.tmc_lot_id}</td>
                      <td className="font-medium">{l.item_name}</td>
                      <td>{l.item_code ?? '—'}</td>
                      <td className="text-right">{Number(l.qty_on_hand).toFixed(2)}</td>
                      <td>{l.unit}</td>
                      <td>{l.location ?? '—'}</td>
                      <td>
                        <span className="badge badge-secondary">
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
