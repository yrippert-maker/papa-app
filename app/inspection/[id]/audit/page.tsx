'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatePanel } from '@/components/ui/StatePanel';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';

const INSPECTION_VIEW_PERMS = ['INSPECTION.VIEW', 'INSPECTION.MANAGE'];

type AuditEvent = {
  id: number;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
  block_hash: string;
  actor_id: string | null;
};

export default function InspectionAuditPage() {
  const params = useParams();
  const { data: session, status } = useSession();
  const id = params?.id as string;
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const permissions = (session?.user as { permissions?: string[] } | undefined)?.permissions ?? [];
  const hasInspectionView = INSPECTION_VIEW_PERMS.some((p) => permissions.includes(p));

  const limit = 50;

  const loadEvents = useCallback(
    (off: number, append: boolean) => {
      if (!id) return;
      const setLoadingState = append ? setLoadingMore : setLoading;
      setLoadingState(true);
      fetch(`/api/inspection/cards/${id}/audit?limit=${limit}&offset=${off}`)
        .then((r) => {
          if (r.status === 403) {
            setForbidden(true);
            return { events: [], total: 0, hasMore: false };
          }
          if (!r.ok) throw new Error(r.status === 404 ? 'Карта не найдена' : 'Ошибка загрузки');
          return r.json();
        })
        .then((data) => {
          const newEvents = data.events ?? [];
          setEvents((prev) => (append ? [...prev, ...newEvents] : newEvents));
          setTotal(data.total ?? 0);
          setHasMore(data.hasMore ?? false);
          setOffset(off + newEvents.length);
        })
        .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка'))
        .finally(() => setLoadingState(false));
    },
    [id]
  );

  useEffect(() => {
    if (status === 'loading' || !id) return;
    if (!hasInspectionView) {
      setForbidden(true);
      setLoading(false);
      return;
    }
    loadEvents(0, false);
  }, [id, status, hasInspectionView, loadEvents]);

  if (status === 'loading' || (hasInspectionView && loading && !forbidden)) {
    return (
      <DashboardLayout>
        <PageHeader title="Журнал событий" />
        <main className="flex-1 p-6 lg:p-8">
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
              <h2 className="text-xl font-semibold text-[#0F172A] dark:text-slate-100 mb-2">Доступ запрещён</h2>
              <p className="text-[#64748B] dark:text-slate-400 mb-4">
                У вас нет прав для просмотра журнала событий (требуется INSPECTION.VIEW).
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

  if (error) {
    return (
      <DashboardLayout>
        <PageHeader title="Журнал событий" />
        <main className="flex-1 p-6 lg:p-8">
          <StatePanel
            variant="error"
            title={error}
            actions={
              <Link href="/inspection" className="btn btn-secondary">
                К списку
              </Link>
            }
          />
        </main>
      </DashboardLayout>
    );
  }

  const eventTypeLabels: Record<string, string> = {
    INSPECTION_CARD_TRANSITION: 'Смена статуса',
    INSPECTION_CHECK_RECORDED: 'Запись результата проверки',
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Журнал событий"
        subtitle={`Техкарта ${id}`}
        actions={
          <Link href={`/inspection/${id}`} className="btn btn-ghost btn-sm">
            ← К карте
          </Link>
        }
      />
      <main className="flex-1 p-6 lg:p-8">
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-[#0F172A] dark:text-slate-100">
              События по техкарте
            </h3>
          </div>
          <div className="card-body">
            {events.length === 0 ? (
              <StatePanel variant="empty" title="Нет событий" description="Журнал событий по этой карте пуст." />
            ) : (
              <div className="space-y-4">
                {events.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30"
                  >
                    <div className="flex items-center justify-between gap-4 mb-2">
                      <span className="badge badge-primary">
                        {eventTypeLabels[ev.event_type] ?? ev.event_type}
                      </span>
                      <span className="text-xs text-[#64748B] dark:text-slate-400">
                        {new Date(ev.created_at).toLocaleString('ru-RU')}
                      </span>
                    </div>
                    <div className="text-sm text-[#0F172A] dark:text-slate-200 space-y-1">
                      {ev.event_type === 'INSPECTION_CARD_TRANSITION' && (
                        <>
                          <p>
                            {String(ev.payload.from_status ?? '')} → {String(ev.payload.to_status ?? '')}
                          </p>
                          {ev.payload.transitioned_by && (
                            <p className="text-[#64748B] dark:text-slate-400">
                              Исполнитель: {String(ev.payload.transitioned_by)}
                            </p>
                          )}
                        </>
                      )}
                      {ev.event_type === 'INSPECTION_CHECK_RECORDED' && (
                        <>
                          <p>
                            {String(ev.payload.check_code ?? '')}: {String(ev.payload.result ?? '')}
                            {ev.payload.value != null && ` (${String(ev.payload.value)} ${String(ev.payload.unit ?? '')})`}
                          </p>
                          {ev.payload.recorded_by && (
                            <p className="text-[#64748B] dark:text-slate-400">
                              Записал: {String(ev.payload.recorded_by)}
                            </p>
                          )}
                          {ev.payload.comment && (
                            <p className="italic">{String(ev.payload.comment)}</p>
                          )}
                        </>
                      )}
                    </div>
                    <p className="mt-2 text-xs font-mono text-[#94a3b8] dark:text-slate-500 truncate" title={ev.block_hash}>
                      {ev.block_hash}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {hasMore && !loading && (
              <div className="mt-4 flex justify-center">
                <button
                  onClick={() => loadEvents(offset, true)}
                  disabled={loadingMore}
                  className="btn btn-secondary"
                >
                  {loadingMore ? 'Загрузка...' : 'Загрузить ещё'}
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </DashboardLayout>
  );
}
