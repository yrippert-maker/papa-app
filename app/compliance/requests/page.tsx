'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatePanel } from '@/components/ui/StatePanel';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

const COMPLIANCE_PERMS = ['COMPLIANCE.VIEW', 'COMPLIANCE.MANAGE', 'ADMIN.MANAGE_USERS'];
const MANAGE_PERMS = ['COMPLIANCE.MANAGE', 'ADMIN.MANAGE_USERS'];

type KeyLifecycleRequest = {
  id: string;
  action: 'ROTATE' | 'REVOKE';
  target_key_id: string | null;
  reason: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'EXECUTED';
  initiator_id: string;
  approver_id: string | null;
  rejection_reason: string | null;
  created_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  executed_at: string | null;
  expires_at: string;
};

export default function ComplianceRequestsPage() {
  const { data: session, status } = useSession();
  const [requests, setRequests] = useState<KeyLifecycleRequest[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ action: 'ROTATE' as 'ROTATE' | 'REVOKE', target_key_id: '', reason: '' });

  const permissions = (session?.user as { permissions?: string[] } | undefined)?.permissions ?? [];
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const hasView = COMPLIANCE_PERMS.some((p) => permissions.includes(p));
  const hasManage = MANAGE_PERMS.some((p) => permissions.includes(p));

  const fetchRequests = async () => {
    try {
      const res = await fetch('/api/compliance/keys/requests?limit=50');
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      const data = await res.json();
      setRequests(data.requests ?? []);
      setPendingCount(data.pending_count ?? 0);
    } catch (err) {
      console.error('Failed to fetch requests:', err);
    }
  };

  useEffect(() => {
    if (status === 'loading') return;
    if (!hasView) {
      setForbidden(true);
      setLoading(false);
      return;
    }
    fetchRequests().finally(() => setLoading(false));
  }, [status, hasView]);

  const handleCreate = async () => {
    setActionLoading('create');
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/compliance/keys/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || 'Failed to create request');
        return;
      }
      setSuccess('Запрос создан. Ожидает утверждения.');
      setShowCreateModal(false);
      setCreateForm({ action: 'ROTATE', target_key_id: '', reason: '' });
      await fetchRequests();
    } catch (err) {
      setError('Network error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/compliance/keys/requests/${id}/approve`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || 'Failed to approve');
        return;
      }
      setSuccess('Запрос одобрен');
      await fetchRequests();
    } catch (err) {
      setError('Network error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Причина отклонения (опционально):');
    setActionLoading(id);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/compliance/keys/requests/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || 'Failed to reject');
        return;
      }
      setSuccess('Запрос отклонён');
      await fetchRequests();
    } catch (err) {
      setError('Network error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleExecute = async (id: string) => {
    if (!confirm('Выполнить одобренный запрос?')) return;
    setActionLoading(id);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/compliance/keys/requests/${id}/execute`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || 'Failed to execute');
        return;
      }
      setSuccess(`Запрос выполнен: ${data.message}`);
      await fetchRequests();
    } catch (err) {
      setError('Network error');
    } finally {
      setActionLoading(null);
    }
  };

  if (status === 'loading' || (hasView && loading && !forbidden)) {
    return (
      <DashboardLayout>
        <PageHeader title="Запросы на изменение ключей" subtitle="2-man rule approval flow" />
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

  const StatusBadge = ({ status }: { status: string }) => {
    const classes: Record<string, string> = {
      PENDING: 'badge-warning',
      APPROVED: 'badge-info',
      REJECTED: 'badge-error',
      EXPIRED: 'badge-secondary',
      EXECUTED: 'badge-success',
    };
    return <span className={`badge ${classes[status] ?? 'badge-secondary'}`}>{status}</span>;
  };

  const ActionBadge = ({ action }: { action: string }) => {
    return (
      <span className={`badge badge-sm ${action === 'ROTATE' ? 'badge-info' : 'badge-error'}`}>
        {action}
      </span>
    );
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Запросы на изменение ключей"
        subtitle={`2-man rule approval flow • ${pendingCount} ожидают`}
        actions={
          hasManage && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreateModal(true)}>
              + Новый запрос
            </button>
          )
        }
      />
      <main className="flex-1 p-6 lg:p-8 space-y-6">
        {error && (
          <div className="alert alert-error">
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="alert alert-success">
            <span>{success}</span>
          </div>
        )}

        {/* Requests Table */}
        <div className="card">
          <div className="card-body">
            {requests.length === 0 ? (
              <p className="text-[#64748B] dark:text-slate-400">Нет запросов</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Статус</th>
                    <th>Действие</th>
                    <th>Инициатор</th>
                    <th>Создан</th>
                    <th>Истекает</th>
                    <th>Approver</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => {
                    const canApprove = hasManage && r.status === 'PENDING' && r.initiator_id !== userId;
                    const canReject = hasManage && r.status === 'PENDING';
                    const canExecute = hasManage && r.status === 'APPROVED';
                    const isExpired = new Date(r.expires_at) < new Date();
                    
                    return (
                      <tr key={r.id} className={isExpired && r.status === 'PENDING' ? 'opacity-50' : ''}>
                        <td><StatusBadge status={r.status} /></td>
                        <td>
                          <ActionBadge action={r.action} />
                          {r.target_key_id && (
                            <span className="ml-2 font-mono text-xs">{r.target_key_id}</span>
                          )}
                        </td>
                        <td className="text-sm">{r.initiator_id}</td>
                        <td className="text-xs">{formatDate(r.created_at)}</td>
                        <td className="text-xs">
                          {formatDate(r.expires_at)}
                          {isExpired && r.status === 'PENDING' && <span className="text-error ml-1">(истёк)</span>}
                        </td>
                        <td className="text-sm">{r.approver_id ?? '—'}</td>
                        <td>
                          <div className="flex gap-1">
                            {canApprove && !isExpired && (
                              <button
                                className="btn btn-success btn-xs"
                                onClick={() => handleApprove(r.id)}
                                disabled={actionLoading === r.id}
                              >
                                Одобрить
                              </button>
                            )}
                            {canReject && (
                              <button
                                className="btn btn-ghost btn-xs text-error"
                                onClick={() => handleReject(r.id)}
                                disabled={actionLoading === r.id}
                              >
                                Отклонить
                              </button>
                            )}
                            {canExecute && !isExpired && (
                              <button
                                className="btn btn-primary btn-xs"
                                onClick={() => handleExecute(r.id)}
                                disabled={actionLoading === r.id}
                              >
                                Выполнить
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="card bg-slate-50 dark:bg-slate-800">
          <div className="card-body text-sm">
            <h4 className="font-medium mb-2">2-Man Rule</h4>
            <ul className="list-disc list-inside space-y-1 text-[#64748B] dark:text-slate-400">
              <li>Инициатор создаёт запрос на ROTATE или REVOKE</li>
              <li>Другой пользователь с COMPLIANCE.MANAGE одобряет</li>
              <li>После одобрения запрос можно выполнить</li>
              <li>Timeout: 24ч на одобрение, 1ч на выполнение</li>
            </ul>
          </div>
        </div>

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="card max-w-md w-full m-4">
              <div className="card-header">
                <h3 className="text-lg font-semibold">Новый запрос</h3>
              </div>
              <div className="card-body space-y-4">
                <div>
                  <label className="label">Действие</label>
                  <select
                    className="select select-bordered w-full"
                    value={createForm.action}
                    onChange={(e) => setCreateForm({ ...createForm, action: e.target.value as 'ROTATE' | 'REVOKE' })}
                  >
                    <option value="ROTATE">ROTATE — ротация ключа</option>
                    <option value="REVOKE">REVOKE — отзыв ключа</option>
                  </select>
                </div>
                {createForm.action === 'REVOKE' && (
                  <div>
                    <label className="label">Key ID для отзыва</label>
                    <input
                      type="text"
                      className="input input-bordered w-full font-mono"
                      placeholder="e.g. abc123def456"
                      value={createForm.target_key_id}
                      onChange={(e) => setCreateForm({ ...createForm, target_key_id: e.target.value })}
                    />
                  </div>
                )}
                <div>
                  <label className="label">Причина (опционально)</label>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    placeholder="Scheduled rotation, compromised, etc."
                    value={createForm.reason}
                    onChange={(e) => setCreateForm({ ...createForm, reason: e.target.value })}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    className="btn btn-ghost"
                    onClick={() => setShowCreateModal(false)}
                    disabled={actionLoading === 'create'}
                  >
                    Отмена
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleCreate}
                    disabled={actionLoading === 'create' || (createForm.action === 'REVOKE' && !createForm.target_key_id)}
                  >
                    {actionLoading === 'create' ? 'Создание...' : 'Создать'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}
