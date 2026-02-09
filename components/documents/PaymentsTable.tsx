'use client';

import { useState } from 'react';

/**
 * Сводная таблица реестра платежей с назначением.
 * Отображает: дата, сумма, валюта, контрагент, назначение (invoice), банк. ref.
 * FR-6.3: экспорт в Excel/PDF.
 */
export type PaymentsItem = {
  payment_id: string;
  date: string;
  amount: number;
  currency: string;
  counterparty: string;
  invoice: string | null;
  bank_ref: string | null;
  source_mail_id?: string;
};

type Props = {
  items: PaymentsItem[];
  showQuarterly?: boolean;
};

function byQuarter(items: PaymentsItem[]): Map<string, PaymentsItem[]> {
  const map = new Map<string, PaymentsItem[]>();
  for (const it of items) {
    const d = new Date(it.date);
    const y = d.getFullYear();
    const q = Math.floor(d.getMonth() / 3) + 1;
    const key = `${y}-Q${q}`;
    const arr = map.get(key) ?? [];
    arr.push(it);
    map.set(key, arr);
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => a.date.localeCompare(b.date));
  }
  return map;
}

function ExportButtons({ items }: { items: PaymentsItem[] }) {
  const [loading, setLoading] = useState<string | null>(null);
  const handleExport = async (format: 'xlsx' | 'pdf') => {
    setLoading(format);
    try {
      const res = await fetch('/api/documents/finance/payments/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format,
          items: items.map((it) => ({
            payment_id: it.payment_id,
            date: it.date,
            amount: it.amount,
            currency: it.currency,
            counterparty: it.counterparty,
            invoice: it.invoice ?? null,
            bank_ref: it.bank_ref ?? null,
          })),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payments_${new Date().toISOString().slice(0, 10)}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed:', e);
    } finally {
      setLoading(null);
    }
  };
  return (
    <div className="flex gap-2 mb-3">
      <button
        type="button"
        onClick={() => handleExport('xlsx')}
        disabled={!!loading}
        className="px-3 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
      >
        {loading === 'xlsx' ? '…' : '📊 Excel'}
      </button>
      <button
        type="button"
        onClick={() => handleExport('pdf')}
        disabled={!!loading}
        className="px-3 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
      >
        {loading === 'pdf' ? '…' : '📄 PDF'}
      </button>
    </div>
  );
}

export function PaymentsTable({ items, showQuarterly = true }: Props) {
  if (items.length === 0) {
    return (
      <p className="text-slate-500 dark:text-slate-400 text-sm">
        Реестр пуст. Платежи появляются после одобрения в очереди почты.
      </p>
    );
  }

  const quarters = byQuarter(items);
  const sortedQuarters = [...quarters.keys()].sort().reverse();

  return (
    <div className="space-y-6">
      <ExportButtons items={items} />
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-600">
              <th className="text-left py-2 px-3 font-medium text-slate-700 dark:text-slate-300">Дата</th>
              <th className="text-right py-2 px-3 font-medium text-slate-700 dark:text-slate-300">Сумма</th>
              <th className="text-left py-2 px-3 font-medium text-slate-700 dark:text-slate-300">Валюта</th>
              <th className="text-left py-2 px-3 font-medium text-slate-700 dark:text-slate-300">Контрагент</th>
              <th className="text-left py-2 px-3 font-medium text-slate-700 dark:text-slate-300">Назначение платежа</th>
              <th className="text-left py-2 px-3 font-medium text-slate-700 dark:text-slate-300">Банк. ref.</th>
            </tr>
          </thead>
          <tbody>
            {items
              .slice()
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((it) => (
                <tr key={it.payment_id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="py-2 px-3 text-slate-600 dark:text-slate-400">{it.date}</td>
                  <td className="py-2 px-3 text-right font-mono">{it.amount.toLocaleString('ru-RU')}</td>
                  <td className="py-2 px-3 text-slate-600 dark:text-slate-400">{it.currency}</td>
                  <td className="py-2 px-3 text-slate-900 dark:text-white max-w-[180px] truncate" title={it.counterparty}>
                    {it.counterparty}
                  </td>
                  <td className="py-2 px-3 text-slate-700 dark:text-slate-300 max-w-[220px] truncate" title={it.invoice ?? ''}>
                    {it.invoice ?? '—'}
                  </td>
                  <td className="py-2 px-3 text-slate-500 dark:text-slate-400 text-xs">{it.bank_ref ?? '—'}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {showQuarterly && sortedQuarters.length > 0 && (
        <section className="rounded-lg border border-slate-200 dark:border-slate-600 p-4 bg-slate-50 dark:bg-slate-800/50">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
            Ежеквартальная сводка (для аудитора)
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedQuarters.map((q) => {
              const qItems = quarters.get(q)!;
              const byCurrency = qItems.reduce(
                (acc, it) => {
                  acc[it.currency] = (acc[it.currency] ?? 0) + it.amount;
                  return acc;
                },
                {} as Record<string, number>
              );
              return (
                <div key={q} className="rounded border border-slate-200 dark:border-slate-600 p-3">
                  <div className="font-medium text-slate-900 dark:text-white">{q}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {qItems.length} плат.
                  </div>
                  <div className="text-sm mt-2 space-y-1">
                    {Object.entries(byCurrency).map(([cur, sum]) => (
                      <div key={cur} className="font-mono">
                        {sum.toLocaleString('ru-RU')} {cur}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
