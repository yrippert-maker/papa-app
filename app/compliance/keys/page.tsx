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

type AuditResponse = {
  events: AuditEvent[];
  total: number;
  next_cursor: number | null;
  has_more: boolean;
};

type AuditFilters = {
  from: string;
  to: string;
  action: '' | 'KEY_ROTATED' | 'KEY_REVOKED';
};

export default function ComplianceKeysPage() {
  const { data: session, status } = useSession();
  const [keys, setKeys] = useState<KeysResponse | null>(null);
  const [auditData, setAuditData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Audit filters
  const [filters, setFilters] = useState<AuditFilters>({ from: '', to: '', action: '' });
  const [auditCursor, setAuditCursor] = useState<number | null>(null);

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

  const fetchAudit = async (cursor?: number | null, append = false) => {
    try {
      const params = new URLSearchParams({ limit: '20' });
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      if (filters.action) params.set('action', filters.action);
      if (cursor) params.set('cursor', cursor.toString());
      
      const res = await fetch(`/api/compliance/keys/audit?${params}`);
      if (res.ok) {
        const data: AuditResponse = await res.json();
        if (append && auditData) {
          setAuditData({
            ...data,
            events: [...auditData.events, ...data.events],
          });
        } else {
          setAuditData(data);
        }
        setAuditCursor(data.next_cursor);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, hasView]);

  // Refetch when filters change
  useEffect(() => {
    if (!loading && hasView) {
      fetchAudit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const handleRotate = () => {
    // Redirect to requests page - direct rotation is disabled
    window.location.href = '/compliance/requests';
  };

  const handleRevoke = (keyId: string) => {
    // Redirect to requests page with key ID - direct revocation is disabled
    window.location.href = `/compliance/requests?action=REVOKE&target_key_id=${keyId}`;
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
            >
              🔄 Запрос на ротацию
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
                              onClick={() => handleRevoke(k.key_id)}
                            >
                              Запрос отзыва
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
          <div className="card-header flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-[#0F172A] dark:text-slate-100">
                Журнал действий
                {auditData && <span className="text-sm font-normal text-[#64748B] ml-2">({auditData.total} записей)</span>}
              </h3>
              <a
                href={`/api/compliance/export?type=key-audit${filters.from ? `&from=${filters.from}` : ''}${filters.to ? `&to=${filters.to}` : ''}${filters.action ? `&action=${filters.action}` : ''}`}
                className="btn btn-ghost btn-xs"
                download
              >
                📥 CSV
              </a>
            </div>
            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="label text-xs py-0">От</label>
                <input
                  type="date"
                  className="input input-bordered input-sm w-36"
                  value={filters.from}
                  onChange={(e) => setFilters({ ...filters, from: e.target.value })}
                />
              </div>
              <div>
                <label className="label text-xs py-0">До</label>
                <input
                  type="date"
                  className="input input-bordered input-sm w-36"
                  value={filters.to}
                  onChange={(e) => setFilters({ ...filters, to: e.target.value })}
                />
              </div>
              <div>
                <label className="label text-xs py-0">Действие</label>
                <select
                  className="select select-bordered select-sm w-36"
                  value={filters.action}
                  onChange={(e) => setFilters({ ...filters, action: e.target.value as AuditFilters['action'] })}
                >
                  <option value="">Все</option>
                  <option value="KEY_ROTATED">Ротация</option>
                  <option value="KEY_REVOKED">Отзыв</option>
                </select>
              </div>
              {(filters.from || filters.to || filters.action) && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setFilters({ from: '', to: '', action: '' })}
                >
                  Сбросить
                </button>
              )}
            </div>
          </div>
          <div className="card-body">
            {!auditData?.events?.length ? (
              <p className="text-[#64748B] dark:text-slate-400">Нет записей</p>
            ) : (
              <>
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
                    {auditData.events.map((e) => (
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
                {auditData.has_more && (
                  <div className="mt-4 text-center">
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => fetchAudit(auditCursor, true)}
                    >
                      Загрузить ещё
                    </button>
                  </div>
                )}
              </>
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
