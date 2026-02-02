'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatePanel } from '@/components/ui/StatePanel';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

const COMPLIANCE_PERMS = ['COMPLIANCE.VIEW', 'COMPLIANCE.MANAGE', 'ADMIN.MANAGE_USERS'];
const MANAGE_PERMS = ['COMPLIANCE.MANAGE', 'ADMIN.MANAGE_USERS'];

type KeyInfo = {
  key_id: string;
  status: 'active' | 'archived' | 'revoked';
  created_at?: string;
  archived_at?: string;
  revoked_at?: string;
  revocation_reason?: string;
};

type KeysResponse = {
  active: KeyInfo | null;
  archived: KeyInfo[];
};

type AuditEvent = {
  id: number;
  action: 'KEY_ROTATED' | 'KEY_REVOKED';
  key_id: string;
  new_key_id?: string;
  reason?: string;
  actor_id: string | null;
  created_at: string;
  block_hash: string;
};

export default function ComplianceKeysPage() {
  const { data: session, status } = useSession();
  const [keys, setKeys] = useState<KeysResponse | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const permissions = (session?.user as { permissions?: string[] } | undefined)?.permissions ?? [];
  const hasView = COMPLIANCE_PERMS.some((p) => permissions.includes(p));
  const hasManage = MANAGE_PERMS.some((p) => permissions.includes(p));

  const fetchKeys = async () => {
    try {
      const res = await fetch('/api/compliance/keys');
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      const data = await res.json();
      setKeys(data);
    } catch (err) {
      console.error('Failed to fetch keys:', err);
    }
  };

  const fetchAudit = async () => {
    try {
      const res = await fetch('/api/compliance/keys/audit?limit=20');
      if (res.ok) {
        const data = await res.json();
        setAuditEvents(data.events ?? []);
      }
    } catch (err) {
      console.error('Failed to fetch audit:', err);
    }
  };

  useEffect(() => {
    if (status === 'loading') return;
    if (!hasView) {
      setForbidden(true);
      setLoading(false);
      return;
    }
    Promise.all([fetchKeys(), fetchAudit()]).finally(() => setLoading(false));
  }, [status, hasView]);

  const handleRotate = async () => {
    if (!confirm('Вы уверены, что хотите ротировать ключ? Текущий ключ будет архивирован.')) {
      return;
    }
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/compliance/keys/rotate', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || 'Failed to rotate key');
        return;
      }
      setSuccess('Ключ успешно ротирован');
      await Promise.all([fetchKeys(), fetchAudit()]);
    } catch (err) {
      setError('Network error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevoke = async (keyId: string) => {
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/compliance/keys/${keyId}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: revokeReason || 'Manual revocation' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || 'Failed to revoke key');
        return;
      }
      setSuccess(`Ключ ${keyId} успешно отозван`);
      setShowRevokeModal(null);
      setRevokeReason('');
      await Promise.all([fetchKeys(), fetchAudit()]);
    } catch (err) {
      setError('Network error');
    } finally {
      setActionLoading(false);
    }
  };

  if (status === 'loading' || (hasView && loading && !forbidden)) {
    return (
      <DashboardLayout>
        <PageHeader title="Ключи подписи" subtitle="Управление ключами Evidence" />
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
                У вас нет прав для просмотра ключей (требуется COMPLIANCE.VIEW).
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

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('ru-RU');
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const classes: Record<string, string> = {
      active: 'badge-success',
      archived: 'badge-secondary',
      revoked: 'badge-error',
    };
    const labels: Record<string, string> = {
      active: 'Активный',
      archived: 'Архивный',
      revoked: 'Отозван',
    };
    return (
      <span className={`badge ${classes[status] ?? 'badge-secondary'}`}>
        {labels[status] ?? status}
      </span>
    );
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Ключи подписи"
        subtitle="Управление ключами Evidence"
        actions={
          hasManage && (
            <button
              className="btn btn-primary btn-sm"
              onClick={handleRotate}
              disabled={actionLoading}
            >
              {actionLoading ? 'Ротация...' : '🔄 Ротировать ключ'}
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

        {/* Active Key */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-[#0F172A] dark:text-slate-100">Активный ключ</h3>
          </div>
          <div className="card-body">
            {keys?.active ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-4">
                  <span className="font-mono text-sm bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                    {keys.active.key_id}
                  </span>
                  <StatusBadge status={keys.active.status} />
                </div>
                <p className="text-sm text-[#64748B] dark:text-slate-400">
                  Создан: {formatDate(keys.active.created_at)}
                </p>
              </div>
            ) : (
              <p className="text-[#64748B] dark:text-slate-400">Нет активного ключа</p>
            )}
          </div>
        </div>

        {/* Archived Keys */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-[#0F172A] dark:text-slate-100">Архивные ключи</h3>
          </div>
          <div className="card-body">
            {!keys?.archived?.length ? (
              <p className="text-[#64748B] dark:text-slate-400">Нет архивных ключей</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Key ID</th>
                    <th>Статус</th>
                    <th>Архивирован</th>
                    <th>Отозван</th>
                    <th>Причина</th>
                    {hasManage && <th>Действия</th>}
                  </tr>
                </thead>
                <tbody>
                  {keys.archived.map((k) => (
                    <tr key={k.key_id}>
                      <td className="font-mono text-sm">{k.key_id}</td>
                      <td><StatusBadge status={k.status} /></td>
                      <td className="text-sm">{formatDate(k.archived_at)}</td>
                      <td className="text-sm">{k.status === 'revoked' ? formatDate(k.revoked_at) : '—'}</td>
                      <td className="text-sm max-w-xs truncate">{k.revocation_reason ?? '—'}</td>
                      {hasManage && (
                        <td>
                          {k.status === 'archived' && (
                            <button
                              className="btn btn-ghost btn-xs text-error"
                              onClick={() => setShowRevokeModal(k.key_id)}
                              disabled={actionLoading}
                            >
                              Отозвать
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Audit Log */}
        <div className="card">
          <div className="card-header flex justify-between items-center">
            <h3 className="text-lg font-semibold text-[#0F172A] dark:text-slate-100">Журнал действий</h3>
            <a
              href="/api/compliance/export?type=key-audit"
              className="btn btn-ghost btn-xs"
              download
            >
              📥 CSV
            </a>
          </div>
          <div className="card-body">
            {auditEvents.length === 0 ? (
              <p className="text-[#64748B] dark:text-slate-400">Нет записей</p>
            ) : (
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Время</th>
                    <th>Действие</th>
                    <th>Key ID</th>
                    <th>Детали</th>
                    <th>Актор</th>
                  </tr>
                </thead>
                <tbody>
                  {auditEvents.map((e) => (
                    <tr key={e.id}>
                      <td className="text-xs whitespace-nowrap">{formatDate(e.created_at)}</td>
                      <td>
                        <span className={`badge badge-sm ${e.action === 'KEY_ROTATED' ? 'badge-info' : 'badge-error'}`}>
                          {e.action === 'KEY_ROTATED' ? 'Ротация' : 'Отзыв'}
                        </span>
                      </td>
                      <td className="font-mono text-xs">{e.key_id}</td>
                      <td className="text-xs max-w-xs truncate">
                        {e.action === 'KEY_ROTATED' && e.new_key_id && (
                          <span>→ {e.new_key_id}</span>
                        )}
                        {e.action === 'KEY_REVOKED' && e.reason && (
                          <span title={e.reason}>{e.reason}</span>
                        )}
                      </td>
                      <td className="text-xs">{e.actor_id ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Revoke Modal */}
        {showRevokeModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="card max-w-md w-full m-4">
              <div className="card-header">
                <h3 className="text-lg font-semibold">Отозвать ключ</h3>
              </div>
              <div className="card-body space-y-4">
                <p className="text-sm text-[#64748B] dark:text-slate-400">
                  Вы собираетесь отозвать ключ <strong className="font-mono">{showRevokeModal}</strong>.
                  Все evidence, подписанные этим ключом, будут показывать статус KEY_REVOKED при верификации.
                </p>
                <div>
                  <label className="label">Причина отзыва</label>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    placeholder="Например: compromised, policy rotation"
                    value={revokeReason}
                    onChange={(e) => setRevokeReason(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      setShowRevokeModal(null);
                      setRevokeReason('');
                    }}
                    disabled={actionLoading}
                  >
                    Отмена
                  </button>
                  <button
                    className="btn btn-error"
                    onClick={() => handleRevoke(showRevokeModal)}
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Отзыв...' : 'Отозвать'}
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
