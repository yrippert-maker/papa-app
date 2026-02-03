'use client';

import { useState } from 'react';

interface Row {
  id: string;
  type: string;
  serial: string;
  lastCheck: string;
  nextCheck: string;
  status: string;
}

const STATUS_LABEL: Record<string, string> = {
  ok: 'OK',
  due_soon: '⚠ Скоро',
  overdue: 'Просрочено',
};

export function SafetyTable({
  rows,
  columns,
  focusId,
  filterStatus,
}: {
  rows: Row[];
  columns: (keyof Row)[];
  focusId?: string;
  filterStatus?: string;
}) {
  const [drawerId, setDrawerId] = useState<string | null>(focusId ?? null);

  const filtered =
    filterStatus && filterStatus !== 'all'
      ? rows.filter((r) => r.status === filterStatus)
      : rows;

  const focusedRow = focusId ? filtered.find((r) => r.id === focusId) : null;
  const openDrawer = drawerId ?? (focusedRow ? focusedRow.id : null);

  return (
    <div className="flex gap-6">
      <div className="flex-1 card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Тип</th>
                <th>Серийный</th>
                <th>Дата поверки</th>
                <th>Следующая</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  className={`cursor-pointer ${
                    openDrawer === r.id ? 'bg-blue-50 dark:bg-blue-950/20' : ''
                  }`}
                  onClick={() => setDrawerId(r.id === openDrawer ? null : r.id)}
                >
                  <td>{r.id}</td>
                  <td>{r.type}</td>
                  <td>{r.serial}</td>
                  <td>{r.lastCheck}</td>
                  <td>{r.nextCheck}</td>
                  <td>
                    <span
                      className={`badge ${
                        r.status === 'ok'
                          ? 'badge-success'
                          : r.status === 'due_soon'
                            ? 'badge-warning'
                            : 'badge-error'
                      }`}
                    >
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-sm btn-ghost">PDF</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {openDrawer && (
        <div className="w-96 card flex-shrink-0">
          <div className="card-header py-4 flex justify-between items-center">
            <h3 className="text-base font-semibold">Детали</h3>
            <button
              onClick={() => setDrawerId(null)}
              className="btn btn-sm btn-ghost"
              aria-label="Закрыть"
            >
              ×
            </button>
          </div>
          <div className="card-body">
            {(() => {
              const r = filtered.find((x) => x.id === openDrawer);
              if (!r) return null;
              return (
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm text-slate-500">ID</dt>
                    <dd className="font-medium">{r.id}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Тип</dt>
                    <dd>{r.type}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Серийный номер</dt>
                    <dd>{r.serial}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Последняя поверка</dt>
                    <dd>{r.lastCheck}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Следующая поверка</dt>
                    <dd>{r.nextCheck}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Статус</dt>
                    <dd>
                      <span
                        className={`badge ${
                          r.status === 'ok'
                            ? 'badge-success'
                            : r.status === 'due_soon'
                              ? 'badge-warning'
                              : 'badge-error'
                        }`}
                      >
                        {STATUS_LABEL[r.status]}
                      </span>
                    </dd>
                  </div>
                  <div className="pt-4">
                    <button className="btn btn-outline btn-sm">Прикрепить PDF</button>
                  </div>
                </dl>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
