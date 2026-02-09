'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

export default function TelegramBindPage() {
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGetCode() {
    setLoading(true);
    setCode(null);
    setHint(null);
    setError(null);
    try {
      const res = await fetch('/api/settings/telegram/bind', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Ошибка');
        return;
      }
      setCode(data.code);
      setHint(data.hint);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout>
      <main className="p-6 lg:p-8 max-w-2xl">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
          Привязать Telegram (FR-7.6)
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          Привяжите Telegram-аккаунт для получения уведомлений. После получения кода отправьте боту команду{' '}
          <code className="rounded bg-slate-100 px-1 dark:bg-slate-700">/bind &lt;код&gt;</code>.
        </p>
        <button
          onClick={handleGetCode}
          disabled={loading}
          className="btn btn-primary mb-4"
        >
          {loading ? '…' : 'Получить код'}
        </button>
        {code && (
          <div className="rounded-lg border border-slate-200 dark:border-slate-600 p-4 bg-slate-50 dark:bg-slate-800/50">
            <p className="text-sm font-mono text-slate-900 dark:text-white mb-2">{code}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">Код действителен 10 минут</p>
          </div>
        )}
        {error && <p className="text-amber-600 dark:text-amber-400 text-sm">{error}</p>}
      </main>
    </DashboardLayout>
  );
}
