'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatePanel } from '@/components/ui/StatePanel';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

const COMPLIANCE_PERMS = ['COMPLIANCE.VIEW', 'COMPLIANCE.MANAGE', 'ADMIN.MANAGE_USERS'];

type SnapshotSummary = {
  filename: string;
  date: string;
  snapshot_id: string;
};

type SignedSnapshot = {
  snapshot: {
    snapshot_version: string;
    snapshot_id: string;
    generated_at: string;
    period: { from: string; to: string };
    policy: { version: string; hash: string };
    keys: {
      active: { key_id: string } | null;
      archived_count: number;
      revoked_count: number;
    };
    events: {
      rotations: number;
      revocations: number;
      approval_requests: number;
    };
    previous_snapshot_hash: string | null;
    snapshot_hash: string;
  };
  signature: string;
  key_id: string;
  signed_at: string;
};

export default function ComplianceSnapshotsPage() {
  const { data: session, status } = useSession();
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<SignedSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const permissions = (session?.user as { permissions?: string[] } | undefined)?.permissions ?? [];
  const hasView = COMPLIANCE_PERMS.some((p) => permissions.includes(p));

  useEffect(() => {
    if (status === 'loading') return;
    if (!hasView) {
      setForbidden(true);
      setLoading(false);
      return;
    }

    fetch('/api/compliance/snapshots')
      .then((res) => {
        if (res.status === 403) {
          setForbidden(true);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.snapshots) {
          setSnapshots(data.snapshots);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch snapshots:', err);
        setError('Failed to load snapshots');
      })
      .finally(() => setLoading(false));
  }, [status, hasView]);

  const loadSnapshot = async (filename: string) => {
    try {
      const res = await fetch(`/api/compliance/snapshots?filename=${filename}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedSnapshot(data);
      }
    } catch (err) {
      console.error('Failed to load snapshot:', err);
    }
  };

  if (status === 'loading' || (hasView && loading && !forbidden)) {
    return (
      <DashboardLayout>
        <PageHeader title="Audit Snapshots" subtitle="Периодические отчёты для аудита" />
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
              <p className="text-[#64748B] dark:text-slate-400 mb-4">
                У вас нет прав для просмотра (требуется COMPLIANCE.VIEW).
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

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('ru-RU');
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Audit Snapshots"
        subtitle={`${snapshots.length} снимков`}
      />
      <main className="flex-1 p-6 lg:p-8 space-y-6">
        {error && (
          <div className="alert alert-error">
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Snapshots List */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-[#0F172A] dark:text-slate-100">История снимков</h3>
            </div>
            <div className="card-body">
              {snapshots.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-[#64748B] dark:text-slate-400 mb-4">Нет снимков</p>
                  <p className="text-sm text-[#64748B]">
                    Запустите: <code className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">npm run audit:snapshot:daily</code>
                  </p>
                </div>
              ) : (
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Дата</th>
                      <th>ID</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshots.map((s) => (
                      <tr
                        key={s.filename}
                        className={selectedSnapshot?.snapshot.snapshot_id.startsWith(s.snapshot_id) ? 'bg-primary/10' : ''}
                      >
                        <td className="text-sm">{s.date}</td>
                        <td className="font-mono text-xs">{s.snapshot_id}</td>
                        <td>
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={() => loadSnapshot(s.filename)}
                          >
                            Просмотр
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Snapshot Detail */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-[#0F172A] dark:text-slate-100">
                {selectedSnapshot ? `Снимок ${selectedSnapshot.snapshot.snapshot_id.slice(0, 8)}` : 'Выберите снимок'}
              </h3>
            </div>
            <div className="card-body">
              {!selectedSnapshot ? (
                <p className="text-[#64748B] dark:text-slate-400">Выберите снимок из списка</p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Период</h4>
                    <p className="text-sm text-[#64748B]">
                      {formatDate(selectedSnapshot.snapshot.period.from)} — {formatDate(selectedSnapshot.snapshot.period.to)}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-2">Policy</h4>
                    <p className="text-sm font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded inline-block">
                      v{selectedSnapshot.snapshot.policy.version} ({selectedSnapshot.snapshot.policy.hash})
                    </p>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-2">Keys</h4>
                    <div className="text-sm space-y-1">
                      <p>Active: <span className="font-mono">{selectedSnapshot.snapshot.keys.active?.key_id ?? 'none'}</span></p>
                      <p>Archived: {selectedSnapshot.snapshot.keys.archived_count}</p>
                      <p>Revoked: {selectedSnapshot.snapshot.keys.revoked_count}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-2">Events в периоде</h4>
                    <div className="text-sm space-y-1">
                      <p>Rotations: {selectedSnapshot.snapshot.events.rotations}</p>
                      <p>Revocations: {selectedSnapshot.snapshot.events.revocations}</p>
                      <p>Approval requests: {selectedSnapshot.snapshot.events.approval_requests}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-2">Подпись</h4>
                    <div className="text-xs space-y-1">
                      <p>Key: <span className="font-mono">{selectedSnapshot.key_id}</span></p>
                      <p>Signed: {formatDate(selectedSnapshot.signed_at)}</p>
                      <p className="font-mono break-all text-[#64748B]">
                        {selectedSnapshot.signature.slice(0, 32)}...
                      </p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-2">Hash Chain</h4>
                    <div className="text-xs space-y-1">
                      <p>Current: <span className="font-mono">{selectedSnapshot.snapshot.snapshot_hash.slice(0, 16)}...</span></p>
                      <p>Previous: <span className="font-mono">{selectedSnapshot.snapshot.previous_snapshot_hash?.slice(0, 16) ?? 'genesis'}...</span></p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CLI Info */}
        <div className="card bg-slate-50 dark:bg-slate-800">
          <div className="card-body text-sm">
            <h4 className="font-medium mb-2">CLI Commands</h4>
            <div className="space-y-1 font-mono text-xs">
              <p><code>npm run audit:snapshot:daily</code> — generate daily snapshot</p>
              <p><code>npm run audit:snapshot:weekly</code> — generate weekly snapshot</p>
              <p><code>npm run audit:snapshot:verify</code> — verify all snapshots</p>
            </div>
          </div>
        </div>
      </main>
    </DashboardLayout>
  );
}
