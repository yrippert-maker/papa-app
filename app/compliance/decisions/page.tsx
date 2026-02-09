'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatePanel } from '@/components/ui/StatePanel';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

const COMPLIANCE_PERMS = ['COMPLIANCE.VIEW', 'COMPLIANCE.MANAGE', 'ADMIN.MANAGE_USERS'];

type DecisionSummary = {
  decision_id: string;
  generated_at: string;
  outcome: 'pass' | 'fail';
  outcome_why: string;
  pack_id: string | null;
  ledger_entry_id: string | null;
};

export default function DecisionHistoryPage() {
  const { data: session, status } = useSession();
  const [decisions, setDecisions] = useState<DecisionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const permissions = (session?.user as { permissions?: string[] } | undefined)?.permissions ?? [];
  const hasView = COMPLIANCE_PERMS.some((p) => permissions.includes(p));

  useEffect(() => {
    if (status === 'loading') return;
    if (!hasView) {
      setForbidden(true);
      setLoading(false);
      return;
    }
    fetch('/api/compliance/decisions')
      .then((res) => {
        if (res.status === 403) {
          setForbidden(true);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.decisions) setDecisions(data.decisions);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [status, hasView]);

  if (status === 'loading' || (hasView && loading && !forbidden)) {
    return (
      <DashboardLayout>
        <PageHeader title="История решений" subtitle="Верификация audit pack" />
        <main className="flex-1 p-6 lg:p-8">
          <StatePanel variant="loading" title="Загрузка..." />
        </main>
      </DashboardLayout>
    );
  }

  if (forbidden || !hasView) {
    return (
      <DashboardLayout>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="card max-w-md w-full text-center">
            <div className="card-body">
              <h2 className="text-xl font-semibold text-[#0F172A] dark:text-slate-100 mb-2">Доступ запрещён</h2>
              <p className="text-[#64748B] dark:text-slate-400 mb-4">Требуется COMPLIANCE.VIEW.</p>
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
        title="История решений"
        subtitle="Решения верификации audit pack — decision_id → ledger_entry_id → anchor"
      />
      <main className="flex-1 p-6 lg:p-8">
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-[#0F172A] dark:text-slate-100">Список решений</h3>
          </div>
          <div className="card-body overflow-x-auto">
            {decisions.length === 0 ? (
              <p className="text-[#64748B] dark:text-slate-400 py-8 text-center">
                Нет решений. Запустите independent-verify на audit pack или используйте demo fixtures.
              </p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Decision ID</th>
                    <th>Дата</th>
                    <th>Результат</th>
                    <th>Pack</th>
                    <th>Ledger Entry</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {decisions.map((d) => (
                    <tr key={d.decision_id}>
                      <td className="font-mono text-sm">{d.decision_id.slice(0, 8)}…</td>
                      <td>{new Date(d.generated_at).toLocaleString()}</td>
                      <td>
                        <span
                          className={`badge ${d.outcome === 'pass' ? 'badge-success' : 'badge-danger'}`}
                        >
                          {d.outcome.toUpperCase()}
                        </span>
                      </td>
                      <td className="text-sm">{d.pack_id ?? '—'}</td>
                      <td className="font-mono text-xs">
                        {d.ledger_entry_id ? `${d.ledger_entry_id.slice(0, 8)}…` : '—'}
                      </td>
                      <td>
                        <a
                          href={`/compliance/decisions/${d.decision_id}`}
                          className="btn btn-sm btn-outline"
                        >
                          Подробнее
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        <p className="text-sm text-[#64748B] dark:text-slate-400 mt-4">
          Источник: decision-record.json в audit packs (workspace + fixtures). Verified in ledger.
        </p>
      </main>
    </DashboardLayout>
  );
}
