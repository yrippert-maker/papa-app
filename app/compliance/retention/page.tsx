'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatePanel } from '@/components/ui/StatePanel';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

const COMPLIANCE_PERMS = ['COMPLIANCE.VIEW', 'COMPLIANCE.MANAGE', 'ADMIN.MANAGE_USERS'];

type RetentionPolicy = {
  version: string;
  updated_at: string;
  targets: {
    dead_letter: {
      retention_days: number;
      max_size_mb: number;
      rotation_threshold_lines: number;
    };
    keys: {
      archived_retention_years: number;
      revoked_retention: string;
    };
    ledger: {
      retention: string;
      deletion: string;
    };
  };
};

type DeadLetterStatus = {
  current_file: {
    exists: boolean;
    lines: number;
    size_bytes: number;
    modified: string | null;
  } | null;
  archives: Array<{
    name: string;
    age_days: number;
    size_bytes: number;
    exceeds_retention: boolean;
  }>;
  total_archives: number;
  violations: string[];
};

type KeysStatus = {
  active: { key_id: string } | null;
  archived_count: number;
  revoked_count: number;
  oldest_archived: {
    key_id: string;
    age_years: number;
    eligible_for_review: boolean;
  } | null;
  violations: string[];
};

type RetentionReport = {
  generated_at: string;
  policy: RetentionPolicy;
  status: {
    dead_letter: DeadLetterStatus;
    keys: KeysStatus;
  };
  summary: {
    total_violations: number;
    action_required: boolean;
  };
};

export default function RetentionDashboardPage() {
  const { data: session, status } = useSession();
  const [report, setReport] = useState<RetentionReport | null>(null);
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

    fetch('/api/compliance/retention')
      .then((res) => {
        if (res.status === 403) {
          setForbidden(true);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data && !data.error) {
          setReport(data);
        } else if (data?.error) {
          setError(data.error.message);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch retention report:', err);
        setError('Failed to load report');
      })
      .finally(() => setLoading(false));
  }, [status, hasView]);

  if (status === 'loading' || (hasView && loading && !forbidden)) {
    return (
      <DashboardLayout>
        <PageHeader title="Retention Status" subtitle="Политики хранения данных" />
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

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('ru-RU');
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Retention Status"
        subtitle="Политики хранения данных (read-only)"
        actions={
          <span className="text-sm text-[#64748B]">
            Policy v{report?.policy.version}
          </span>
        }
      />
      <main className="flex-1 p-6 lg:p-8 space-y-6">
        {error && (
          <div className="alert alert-error">
            <span>{error}</span>
          </div>
        )}

        {/* Summary */}
        <div className={`card ${report?.summary.action_required ? 'border-warning' : 'border-success'}`}>
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-[#0F172A] dark:text-slate-100">
                  {report?.summary.action_required ? '⚠️ Action Required' : '✅ All OK'}
                </h3>
                <p className="text-sm text-[#64748B] dark:text-slate-400">
                  {report?.summary.total_violations ?? 0} нарушений политики
                </p>
              </div>
              <div className="text-right text-sm text-[#64748B]">
                <p>Сгенерировано:</p>
                <p>{formatDate(report?.generated_at)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Policy Overview */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-[#0F172A] dark:text-slate-100">
              Policy Manifest
            </h3>
          </div>
          <div className="card-body">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Target</th>
                  <th>Parameter</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td rowSpan={3}>Dead Letter</td>
                  <td>Retention</td>
                  <td>{report?.policy.targets.dead_letter.retention_days} дней</td>
                </tr>
                <tr>
                  <td>Max Size</td>
                  <td>{report?.policy.targets.dead_letter.max_size_mb} MB</td>
                </tr>
                <tr>
                  <td>Rotation Threshold</td>
                  <td>{report?.policy.targets.dead_letter.rotation_threshold_lines} lines</td>
                </tr>
                <tr>
                  <td rowSpan={2}>Keys</td>
                  <td>Archived Retention</td>
                  <td>{report?.policy.targets.keys.archived_retention_years} лет</td>
                </tr>
                <tr>
                  <td>Revoked Retention</td>
                  <td>{report?.policy.targets.keys.revoked_retention}</td>
                </tr>
                <tr>
                  <td rowSpan={2}>Ledger</td>
                  <td>Retention</td>
                  <td>{report?.policy.targets.ledger.retention}</td>
                </tr>
                <tr>
                  <td>Deletion</td>
                  <td>{report?.policy.targets.ledger.deletion}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Dead Letter Status */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-[#0F172A] dark:text-slate-100">
              Dead Letter Status
            </h3>
          </div>
          <div className="card-body space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="stat bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                <div className="stat-title text-xs">Current File</div>
                <div className="stat-value text-lg">
                  {report?.status.dead_letter.current_file?.lines ?? 0} lines
                </div>
                <div className="stat-desc text-xs">
                  {formatBytes(report?.status.dead_letter.current_file?.size_bytes ?? 0)}
                </div>
              </div>
              <div className="stat bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                <div className="stat-title text-xs">Archives</div>
                <div className="stat-value text-lg">
                  {report?.status.dead_letter.total_archives ?? 0}
                </div>
                <div className="stat-desc text-xs">files</div>
              </div>
            </div>

            {report?.status.dead_letter.violations.length ? (
              <div className="alert alert-warning">
                <div>
                  <strong>Violations:</strong>
                  <ul className="list-disc list-inside mt-1">
                    {report.status.dead_letter.violations.map((v, i) => (
                      <li key={i} className="text-sm">{v}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-sm text-green-600 dark:text-green-400">✓ No violations</p>
            )}

            {report?.status.dead_letter.archives.length ? (
              <div>
                <h4 className="text-sm font-medium mb-2">Archives</h4>
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Age</th>
                      <th>Size</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.status.dead_letter.archives.slice(0, 10).map((a) => (
                      <tr key={a.name}>
                        <td className="font-mono text-xs">{a.name}</td>
                        <td>{a.age_days} days</td>
                        <td>{formatBytes(a.size_bytes)}</td>
                        <td>
                          {a.exceeds_retention ? (
                            <span className="badge badge-warning badge-sm">Exceeds retention</span>
                          ) : (
                            <span className="badge badge-success badge-sm">OK</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </div>

        {/* Keys Status */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-[#0F172A] dark:text-slate-100">
              Keys Status
            </h3>
          </div>
          <div className="card-body space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="stat bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                <div className="stat-title text-xs">Active Key</div>
                <div className="stat-value text-sm font-mono truncate">
                  {report?.status.keys.active?.key_id ?? 'None'}
                </div>
              </div>
              <div className="stat bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                <div className="stat-title text-xs">Archived</div>
                <div className="stat-value text-lg">
                  {report?.status.keys.archived_count ?? 0}
                </div>
              </div>
              <div className="stat bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                <div className="stat-title text-xs">Revoked</div>
                <div className="stat-value text-lg">
                  {report?.status.keys.revoked_count ?? 0}
                </div>
              </div>
              {report?.status.keys.oldest_archived && (
                <div className="stat bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                  <div className="stat-title text-xs">Oldest Archived</div>
                  <div className="stat-value text-lg">
                    {report.status.keys.oldest_archived.age_years} yrs
                  </div>
                  <div className="stat-desc text-xs font-mono truncate">
                    {report.status.keys.oldest_archived.key_id}
                  </div>
                </div>
              )}
            </div>

            {report?.status.keys.violations.length ? (
              <div className="alert alert-warning">
                <div>
                  <strong>Violations:</strong>
                  <ul className="list-disc list-inside mt-1">
                    {report.status.keys.violations.map((v, i) => (
                      <li key={i} className="text-sm">{v}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-sm text-green-600 dark:text-green-400">✓ No violations</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="card bg-slate-50 dark:bg-slate-800">
          <div className="card-body">
            <h4 className="font-medium mb-2">CLI Commands</h4>
            <div className="space-y-2 font-mono text-sm">
              <p><code>npm run retention:check</code> — проверка (dry-run)</p>
              <p><code>npm run retention:run</code> — применить enforcement</p>
              <p><code>npm run retention:json</code> — JSON для CI</p>
            </div>
          </div>
        </div>
      </main>
    </DashboardLayout>
  );
}
