'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

type MailItem = {
  mail_id: string;
  source_system: string;
  mailbox: string;
  received_at: string;
  from: string;
  subject: string;
  status: string;
  category: string | null;
  summary: string | null;
  risk_flags: string[];
  payment_preview: { amount?: number; currency?: string; counterparty?: string } | null;
  proposed_changes_count: number;
};

export default function MailInboxPage() {
  const { data: session } = useSession();
  const [items, setItems] = useState<MailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (categoryFilter) params.set('category', categoryFilter);
    fetch(`/api/mail/inbox?${params}`)
      .then((r) => r.json())
      .then((data) => setItems(data.items ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [statusFilter, categoryFilter]);

  return (
    <DashboardLayout>
      <main className="p-6 lg:p-8">
        <PageHeader
          title="Очередь писем"
          description="Mail MVP: письма из Gmail и mail.nic.ru после triage. Accept / Reject / Escalate."
        />
        <div className="mb-4 flex flex-wrap gap-2">
          <span className="text-sm text-slate-500 dark:text-slate-400">Фильтры:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          >
            <option value="">Все статусы</option>
            <option value="new">Новые</option>
            <option value="accepted">Принято</option>
            <option value="rejected">Отклонено</option>
            <option value="escalated">Эскалировано</option>
            <option value="request_info">Запрос информации</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          >
            <option value="">Все категории</option>
            <option value="finance_payment">Платёж</option>
            <option value="doc_mura_menasa">Mura Menasa</option>
            <option value="other">Другое</option>
          </select>
        </div>
        {loading ? (
          <p className="text-slate-500 dark:text-slate-400">Загрузка…</p>
        ) : items.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400">
            Нет писем в очереди. После настройки ingestion (Gmail + IMAP nic.ru) здесь появятся письма.
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={item.mail_id}
                className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/mail/${item.mail_id}`}
                      className="font-medium text-slate-900 hover:underline dark:text-white"
                    >
                      {item.subject || '(без темы)'}
                    </Link>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {item.from} · {item.source_system}/{item.mailbox} ·{' '}
                      {new Date(item.received_at).toLocaleString()}
                    </p>
                    {item.summary && (
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{item.summary}</p>
                    )}
                    {item.payment_preview && (
                      <p className="mt-1 text-sm">
                        <span className="text-slate-500 dark:text-slate-400">Платёж:</span>{' '}
                        {item.payment_preview.amount != null && item.payment_preview.currency
                          ? `${item.payment_preview.amount} ${item.payment_preview.currency}`
                          : ''}
                        {item.payment_preview.counterparty
                          ? ` · ${item.payment_preview.counterparty}`
                          : ''}
                      </p>
                    )}
                    {item.risk_flags.length > 0 && (
                      <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                        Risk: {item.risk_flags.join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {item.category && (
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-700">
                        {item.category}
                      </span>
                    )}
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-700">
                      {item.status}
                    </span>
                    <Link
                      href={`/mail/${item.mail_id}`}
                      className="rounded bg-slate-200 px-3 py-1 text-sm hover:bg-slate-300 dark:bg-slate-600 dark:hover:bg-slate-500"
                    >
                      Открыть
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
          <Link href="/documents" className="text-blue-600 dark:text-blue-400 hover:underline">
            Документы
          </Link>
          {' — реестр платежей (Finance) и Mura Menasa.'}
        </p>
      </main>
    </DashboardLayout>
  );
}
