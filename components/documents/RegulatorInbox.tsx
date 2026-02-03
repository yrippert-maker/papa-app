'use client';

import { useEffect, useState } from 'react';
import { ProofPanel } from '@/components/documents/ProofPanel';

interface ChangeEvent {
  id: string;
  source: string;
  title: string;
  summary: string | null;
  severity: string;
  status: string;
  created_at: string;
}

interface InboxDetail extends ChangeEvent {
  proposal?: { id: string; status: string; targets: unknown[] };
}

export function RegulatorInbox({
  focusId,
  initialStatus,
}: {
  focusId?: string;
  initialStatus?: string;
}) {
  const [items, setItems] = useState<ChangeEvent[]>([]);
  const [selected, setSelected] = useState<InboxDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (initialStatus) params.set('status', initialStatus);
    fetch(`/api/compliance/inbox?${params}`)
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .finally(() => setLoading(false));
  }, [initialStatus]);

  useEffect(() => {
    if (focusId && items.length > 0) {
      const it = items.find((i) => i.id === focusId);
      if (it) {
        fetch(`/api/compliance/inbox/${it.id}`)
          .then((r) => r.json())
          .then(setSelected);
      }
    } else {
      setSelected(null);
    }
  }, [focusId, items]);

  const openDetail = (id: string) => {
    fetch(`/api/compliance/inbox/${id}`)
      .then((r) => r.json())
      .then(setSelected);
  };

  const handleAccept = async (id: string) => {
    await fetch(`/api/compliance/inbox/${id}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    openDetail(id);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: 'PROPOSED' } : i)));
  };

  const handleReject = async (id: string) => {
    await fetch(`/api/compliance/inbox/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    setSelected(null);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleApply = async (proposalId: string) => {
    await fetch(`/api/compliance/proposals/${proposalId}/apply`, { method: 'POST' });
    if (selected) openDetail(selected.id);
  };

  if (loading) return <p className="text-slate-500">Загрузка…</p>;

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="card">
        <div className="card-header py-4">
          <h3 className="text-base font-semibold">Новые/изменённые публикации</h3>
        </div>
        <div className="card-body p-0">
          {items.length === 0 ? (
            <p className="px-6 py-8 text-slate-500">Нет новых изменений</p>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-700">
              {items.map((it) => (
                <li
                  key={it.id}
                  className={`px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer ${
                    selected?.id === it.id ? 'bg-blue-50 dark:bg-blue-950/20' : ''
                  }`}
                  onClick={() => openDetail(it.id)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">
                        {it.source} — {it.title}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{it.summary}</p>
                    </div>
                    <span className="badge badge-secondary text-xs">{it.status}</span>
                  </div>
                  {it.status === 'NEW' && (
                    <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleAccept(it.id)}
                        className="btn btn-sm btn-primary"
                      >
                        Принять
                      </button>
                      <button
                        onClick={() => handleReject(it.id)}
                        className="btn btn-sm btn-outline"
                      >
                        Отклонить
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="card">
        <div className="card-header py-4">
          <h3 className="text-base font-semibold">Детали</h3>
        </div>
        <div className="card-body">
          {selected ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-500">Источник</p>
                <p className="font-medium">{selected.source}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Заголовок</p>
                <p className="font-medium">{selected.title}</p>
              </div>
              {selected.summary && (
                <div>
                  <p className="text-sm text-slate-500">Резюме</p>
                  <p>{selected.summary}</p>
                </div>
              )}
              {selected.proposal && (
                <div>
                  <p className="text-sm text-slate-500 mb-2">Proposed patch</p>
                  <p className="text-sm">
                    Proposal: {selected.proposal.id} — {selected.proposal.status}
                  </p>
                  {selected.proposal.status === 'proposed' && (
                    <button
                      onClick={() => handleApply(selected.proposal!.id)}
                      className="btn btn-primary mt-2"
                    >
                      Apply
                    </button>
                  )}
                </div>
              )}
              {!selected.proposal && (selected as ChangeEvent).status === 'NEW' && (
                <p className="text-sm text-slate-500">
                  Нажмите «Принять» для создания patch proposal
                </p>
              )}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Proof</p>
                <ProofPanel changeEventId={selected.id} />
              </div>
            </div>
          ) : (
            <p className="text-slate-500">Выберите элемент из списка</p>
          )}
        </div>
      </div>
    </div>
  );
}
