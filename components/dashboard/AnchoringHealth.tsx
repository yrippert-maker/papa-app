'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { AnchoringHealth } from '@/lib/types/anchoring';

function formatLastAnchor(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
      timeZoneName: 'short',
    });
  } catch {
    return iso;
  }
}

function formatDaysAgo(days: number | null): string {
  if (days === null) return '';
  if (days === 0) return 'сегодня';
  if (days === 1) return 'вчера';
  if (days < 7) return `${days} дн. назад`;
  if (days < 30) return `${Math.floor(days / 7)} нед. назад`;
  return `${days} дн. назад`;
}

export function AnchoringHealth() {
  const [data, setData] = useState<AnchoringHealth | null>(null);

  useEffect(() => {
    const load = () =>
      fetch('/api/anchoring/health', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => setData(d))
        .catch(() => setData(null));
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  if (!data) {
    return (
      <div className="text-sm text-slate-500 dark:text-slate-400 py-2">
        🔗 Anchoring: загрузка…
      </div>
    );
  }

  const { status, lastConfirmedAt, daysSinceLastConfirmed } = data;
  const isOk = status === 'OK';
  const isDelayed = status === 'DELAYED';
  const isFailed = status === 'FAILED';

  const statusLabel =
    isOk ? 'OK' : isDelayed ? 'задержка' : isFailed ? 'ошибка' : status;
  const statusColor = isOk
    ? 'text-emerald-600 dark:text-emerald-400'
    : isDelayed
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-red-600 dark:text-red-400';

  const lastLabel =
    lastConfirmedAt
      ? `Последний: ${isOk ? formatLastAnchor(lastConfirmedAt) : formatDaysAgo(daysSinceLastConfirmed ?? 0)}`
      : 'Нет подтверждённых';

  const content = (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-slate-500 dark:text-slate-400" aria-hidden>
        🔗
      </span>
      <span>
        <span className={`font-medium ${statusColor}`}>Anchoring (Polygon): {statusLabel}</span>
        <span className="text-slate-500 dark:text-slate-400 ml-1">· {lastLabel}</span>
      </span>
    </div>
  );

  if (isOk) {
    return (
      <div className="py-2" title="Система доказательств целостности работает">
        {content}
      </div>
    );
  }

  return (
    <Link
      href="/governance/anchoring"
      className="block py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors -mx-2 px-2"
      title="Подробности anchoring"
    >
      {content}
    </Link>
  );
}
