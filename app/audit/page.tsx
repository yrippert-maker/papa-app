'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useCallback, useEffect, useState } from 'react';

type AuditEvent = {
  id: string;
  actorUserId: string | null;
  action: string;
  target: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filterAction, setFilterAction] = useState('');
  const [filterActor, setFilterActor] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const loadEvents = useCallback((append = false) => {
    setLoading(true);
    if (!append) setError(null);
    setForbidden(false);
    const params = new URLSearchParams();
    if (filterAction) params.set('action', filterAction);
    if (filterActor) params.set('actor', filterActor);
    if (filterFrom) params.set('from', filterFrom);
    if (filterTo) params.set('to', filterTo);
    params.set('limit', '50');
    if (append && nextCursor) params.set('cursor', nextCursor);

    fetch(`/api/audit/events?${params}`)
      .then((r) => {
        if (r.status === 403) {
          setForbidden(true);
          return { events: [], nextCursor: null, hasMore: false };
        }
        if (!r.ok) return r.json().then((d) => Promise.reject(new Error(d.error ?? 'Ошибка')));
        return r.json();
      })
      .then((data) => {
        const items = data.events ?? [];
        setEvents((prev) => (append ? [...prev, ...items] : items));
        setNextCursor(data.nextCursor ?? null);
        setHasMore(data.hasMore ?? false);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, [filterAction, filterActor, filterFrom, filterTo, nextCursor]);

  useEffect(() => {
    loadEvents(false);
  }, [loadEvents]);

  const formatDate = (s: string) => {
    try {
      return new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(s));
    } catch {
      return s;
    }
  };

  if (forbidden) {
    return (
      <DashboardLayout>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="card max-w-md w-full text-center">
            <div className="card-body">
              <h2 className="text-xl font-semibold text-[#0F172A] dark:text-slate-100 mb-2">Доступ запрещён</h2>
              <p className="text-[#64748B] dark:text-slate-400 mb-4">
                У вас нет прав для просмотра аудит-логов (требуется admin или auditor).
              </p>
              <a href="/" className="btn btn-primary">На главную</a>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Аудит"
        subtitle="События системы (auth, rbac, user, compliance)"
      />

      <main className="flex-1 p-6 lg:p-8 space-y-6">
        {error && (
          <div className="alert alert-error">
            <span>{error}</span>
          </div>
        )}

        <div className="card">
          <div className="card-header flex flex-wrap items-center gap-4">
            <h3 className="text-lg font-semibold">Фильтры</h3>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="text"
                placeholder="action (auth.sign_in)"
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="input input-sm w-48"
              />
              <input
                type="text"
                placeholder="actor (userId)"
                value={filterActor}
                onChange={(e) => setFilterActor(e.target.value)}
                className="input input-sm w-40"
              />
              <input
                type="date"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
                className="input input-sm w-36"
              />
              <span className="text-slate-500">—</span>
              <input
                type="date"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
                className="input input-sm w-36"
              />
              <button
                onClick={() => {
                  setNextCursor(null);
                  loadEvents(false);
                }}
                className="btn btn-primary btn-sm"
              >
                Применить
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body overflow-x-auto">
            {loading ? (
              <p className="text-[#64748B] dark:text-slate-400">Загрузка...</p>
            ) : events.length === 0 ? (
              <p className="text-[#64748B] dark:text-slate-400">Нет событий</p>
            ) : (
              <>
              <table className="table table-sm w-full">
                <thead>
                  <tr>
                    <th className="text-left">Дата</th>
                    <th className="text-left">Action</th>
                    <th className="text-left">Target</th>
                    <th className="text-left">Actor</th>
                    <th className="text-left">Metadata</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id}>
                      <td className="text-sm whitespace-nowrap">{formatDate(e.createdAt)}</td>
                      <td className="font-mono text-xs">{e.action}</td>
                      <td className="text-sm">{e.target ?? '—'}</td>
                      <td className="font-mono text-xs">{e.actorUserId ?? '—'}</td>
                      <td className="text-xs max-w-xs truncate">
                        {e.metadata ? JSON.stringify(e.metadata) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {hasMore && (
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={() => loadEvents(true)}
                    disabled={loading}
                    className="btn btn-outline btn-sm"
                  >
                    {loading ? 'Загрузка…' : 'Ещё'}
                  </button>
                </div>
              )}
              </>
            )}
          </div>
        </div>
      </main>
    </DashboardLayout>
  );
}
