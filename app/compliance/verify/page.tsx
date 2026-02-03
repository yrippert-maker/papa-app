'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatePanel } from '@/components/ui/StatePanel';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

const COMPLIANCE_PERMS = ['COMPLIANCE.VIEW', 'COMPLIANCE.MANAGE', 'ADMIN.MANAGE_USERS'];

type VerifyStats = {
  total: number;
  ok: number;
  errors: {
    content_invalid: number;
    key_revoked: number;
    key_not_found: number;
    signature_invalid: number;
    other_error: number;
  };
  rate_limited: number;
  unauthorized: number;
};

type DeadLetterStats = {
  events_total: number;
  replay: {
    dry_run_ok: number;
    dry_run_failed: number;
    live_ok: number;
    live_failed: number;
  };
};

type StatsResponse = {
  verify: VerifyStats;
  dead_letter: DeadLetterStats;
};

export default function ComplianceVerifyPage() {
  const { data: session, status } = useSession();
  const [stats, setStats] = useState<StatsResponse | null>(null);
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
    fetch('/api/compliance/verify-stats')
      .then((res) => {
        if (res.status === 403) {
          setForbidden(true);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) setStats(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [status, hasView]);

  if (status === 'loading' || (hasView && loading && !forbidden)) {
    return (
      <DashboardLayout>
        <PageHeader title="Статистика верификации" subtitle="Метрики Evidence Verify" />
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
                У вас нет прав для просмотра статистики (требуется COMPLIANCE.VIEW).
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

  const verifyStats = stats?.verify;
  const deadLetterStats = stats?.dead_letter;
  const totalErrors = verifyStats
    ? Object.values(verifyStats.errors).reduce((s, v) => s + v, 0)
    : 0;
  const successRate = verifyStats && verifyStats.total > 0
    ? ((verifyStats.ok / verifyStats.total) * 100).toFixed(1)
    : '0.0';

  return (
    <DashboardLayout>
      <PageHeader
        title="Статистика верификации"
        subtitle="Метрики Evidence Verify и Dead-Letter"
        actions={
          <div className="flex gap-2">
            <a
              href="/api/compliance/export?type=verify-stats"
              className="btn btn-outline btn-sm"
              download
            >
              📥 CSV
            </a>
            <Link href="/inspection/verify" className="btn btn-outline btn-sm">
              Проверить Evidence
            </Link>
          </div>
        }
      />
      <main className="flex-1 p-6 lg:p-8 space-y-6">
        {/* Verify Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4">
            <p className="text-sm text-[#64748B] dark:text-slate-400">Всего запросов</p>
            <p className="text-2xl font-bold text-[#0F172A] dark:text-slate-100">{verifyStats?.total ?? 0}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-[#64748B] dark:text-slate-400">Успешных (OK)</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{verifyStats?.ok ?? 0}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-[#64748B] dark:text-slate-400">Success Rate</p>
            <p className="text-2xl font-bold text-[#0F172A] dark:text-slate-100">{successRate}%</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-[#64748B] dark:text-slate-400">Ошибок</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{totalErrors}</p>
          </div>
        </div>

        {/* Error Breakdown */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-[#0F172A] dark:text-slate-100">Разбивка по ошибкам</h3>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded">
                <span className="text-sm">KEY_REVOKED</span>
                <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                  {verifyStats?.errors.key_revoked ?? 0}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded">
                <span className="text-sm">KEY_NOT_FOUND</span>
                <span className="font-mono font-semibold text-orange-600 dark:text-orange-400">
                  {verifyStats?.errors.key_not_found ?? 0}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded">
                <span className="text-sm">SIGNATURE_INVALID</span>
                <span className="font-mono font-semibold text-red-600 dark:text-red-400">
                  {verifyStats?.errors.signature_invalid ?? 0}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded">
                <span className="text-sm">CONTENT_INVALID</span>
                <span className="font-mono font-semibold text-red-600 dark:text-red-400">
                  {verifyStats?.errors.content_invalid ?? 0}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded">
                <span className="text-sm">OTHER_ERROR</span>
                <span className="font-mono font-semibold text-slate-600 dark:text-slate-400">
                  {verifyStats?.errors.other_error ?? 0}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded">
                <span className="text-sm">RATE_LIMITED</span>
                <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                  {verifyStats?.rate_limited ?? 0}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Dead-Letter Stats */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-[#0F172A] dark:text-slate-100">Dead-Letter Status</h3>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded">
                <p className="text-xs text-[#64748B] dark:text-slate-400 mb-1">События в очереди</p>
                <p className={`text-xl font-bold ${(deadLetterStats?.events_total ?? 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {deadLetterStats?.events_total ?? 0}
                </p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded">
                <p className="text-xs text-[#64748B] dark:text-slate-400 mb-1">Dry-run OK</p>
                <p className="text-xl font-bold text-slate-600 dark:text-slate-300">
                  {deadLetterStats?.replay.dry_run_ok ?? 0}
                </p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded">
                <p className="text-xs text-[#64748B] dark:text-slate-400 mb-1">Dry-run Failed</p>
                <p className="text-xl font-bold text-red-600 dark:text-red-400">
                  {deadLetterStats?.replay.dry_run_failed ?? 0}
                </p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded">
                <p className="text-xs text-[#64748B] dark:text-slate-400 mb-1">Live OK</p>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  {deadLetterStats?.replay.live_ok ?? 0}
                </p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded">
                <p className="text-xs text-[#64748B] dark:text-slate-400 mb-1">Live Failed</p>
                <p className="text-xl font-bold text-red-600 dark:text-red-400">
                  {deadLetterStats?.replay.live_failed ?? 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Unauthorized */}
        {(verifyStats?.unauthorized ?? 0) > 0 && (
          <div className="alert alert-warning">
            <span>Unauthorized attempts: {verifyStats?.unauthorized}</span>
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}
