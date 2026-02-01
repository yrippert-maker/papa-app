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
      <PageHeader title="ТМЦ — Остатки" subtitle="Реестр номенклатуры и остатков на складе" />
      <main className="flex-1 p-6 lg:p-8">
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="text-lg font-semibold text-[#0F172A]">Номенклатура</h3>
          </div>
          <div className="card-body overflow-x-auto">
            {loading ? (
              <p className="text-[#64748B]">Загрузка...</p>
            ) : items.length === 0 ? (
              <p className="text-[#64748B]">Нет данных. Добавьте позиции ТМЦ.</p>
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
                      <td>{i.item_code ?? '—'}</td>
                      <td className="font-medium">{i.name}</td>
                      <td>{i.category ?? '—'}</td>
                      <td>{i.manufacturer ?? '—'}</td>
                      <td>{i.part_no ?? '—'}</td>
                      <td className="text-right font-medium">{Number(i.total_on_hand).toFixed(2)}</td>
                      <td className="text-right">{i.lot_count}</td>
                      <td>{i.unit}</td>
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
