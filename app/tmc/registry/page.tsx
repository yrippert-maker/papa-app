'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useEffect, useState } from 'react';

type TmcItem = {
  tmc_item_id: string;
  item_code: string | null;
  name: string;
  unit: string;
  category: string | null;
  manufacturer: string | null;
  part_no: string | null;
  total_on_hand: number;
  lot_count: number;
};

export default function TmcRegistryPage() {
  const [items, setItems] = useState<TmcItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/tmc/items')
      .then((r) => r.json())
      .then((data) => {
        setItems(data.items ?? []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardLayout>
      <PageHeader
        title="ТМЦ — Остатки"
        subtitle="Реестр номенклатуры и остатков на складе"
        breadcrumbs={['ТМЦ']}
      />

      <main className="flex-1 p-6 lg:p-7">
        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="card p-4">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Всего позиций</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{items.length}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Активных лотов</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {items.reduce((s, i) => s + i.lot_count, 0)}
            </p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Категорий</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {new Set(items.map((i) => i.category).filter(Boolean)).size}
            </p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Производителей</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {new Set(items.map((i) => i.manufacturer).filter(Boolean)).size}
            </p>
          </div>
        </div>

        <div className="card">
          <div className="card-header flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Номенклатура</h3>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-mono font-medium text-slate-500">
                {items.length}
              </span>
            </div>
          </div>

          <div className="card-body overflow-x-auto !p-0">
            {loading ? (
              <div className="p-6">
                <p className="text-slate-500 dark:text-slate-400">Загрузка...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="p-6">
                <p className="text-slate-500 dark:text-slate-400">Нет данных. Добавьте позиции ТМЦ.</p>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Код</th>
                    <th>Наименование</th>
                    <th>Категория</th>
                    <th>Производитель</th>
                    <th>Партномер</th>
                    <th className="text-right">Остаток</th>
                    <th className="text-right">Лотов</th>
                    <th>Ед. изм.</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.tmc_item_id}>
                      <td className="font-mono text-xs text-primary font-medium">{i.item_code ?? '—'}</td>
                      <td className="font-medium text-slate-900 dark:text-white">{i.name}</td>
                      <td>
                        {i.category ? (
                          <span className="badge badge-secondary">{i.category}</span>
                        ) : '—'}
                      </td>
                      <td className="text-slate-600 dark:text-slate-300">{i.manufacturer ?? '—'}</td>
                      <td className="font-mono text-xs text-slate-500">{i.part_no ?? '—'}</td>
                      <td className={`text-right font-mono font-semibold ${
                        Number(i.total_on_hand) < 10
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-slate-900 dark:text-white'
                      }`}>
                        {Number(i.total_on_hand).toFixed(2)}
                      </td>
                      <td className="text-right font-mono text-slate-500">{i.lot_count}</td>
                      <td className="text-slate-400 text-xs">{i.unit}</td>
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
