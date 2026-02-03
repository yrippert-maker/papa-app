'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatePanel } from '@/components/ui/StatePanel';
import { useSession } from 'next-auth/react';
import { useState, useCallback, useRef } from 'react';

type VerifyState = 'idle' | 'loading' | 'ok' | 'failed' | 'skipped' | 'rate_limit' | 'error';

type AggregatorResponse = {
  ok?: boolean;
  schema_version?: number;
  generated_at?: string;
  authz_verification?: {
    authz_ok?: boolean;
    message?: string;
    scope?: {
      route_count?: number;
      permission_count?: number;
      role_count?: number;
      deny_by_default_scope?: string;
    };
  };
  ledger_verification?:
    | { ok: true; message?: string; scope?: { event_count: number; id_min: number | null; id_max: number | null } }
    | { ok: false; error?: string }
    | { skipped: true; reason?: string };
  timing_ms?: { total?: number; authz?: number; ledger?: number };
  error?: string;
};

function hasWorkspaceRead(permissions: string[]): boolean {
  return permissions.includes('WORKSPACE.READ');
}

function hasLedgerRead(permissions: string[]): boolean {
  return permissions.includes('LEDGER.READ');
}

export default function SystemVerifyPage() {
  const { data: session } = useSession();
  const permissions = (session?.user as { permissions?: string[] } | undefined)?.permissions ?? [];
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AggregatorResponse | null>(null);
  const [overallState, setOverallState] = useState<VerifyState>('idle');
  const inFlightRef = useRef(false);

  const runVerify = useCallback(() => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    setResult(null);
    setOverallState('idle');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    fetch('/api/system/verify', { signal: controller.signal })
      .then((r) => {
        if (r.status === 429) {
          setOverallState('rate_limit');
          return null;
        }
        return r.json().then((body: AggregatorResponse) => ({ status: r.status, body }));
      })
      .then((data) => {
        if (!data) return;
        const { status, body } = data;
        setResult(body);
        if (status !== 200) {
          setOverallState(status === 500 ? 'error' : 'failed');
          return;
        }
        setOverallState(body.ok ? 'ok' : 'failed');
      })
      .catch((e) => {
        if (e.name === 'AbortError') {
          setOverallState('error');
          setResult({ error: 'Request timeout' });
        } else {
          setOverallState('error');
          setResult(null);
        }
      })
      .finally(() => {
        clearTimeout(timeoutId);
        setLoading(false);
        inFlightRef.current = false;
      });
  }, []);

  if (!hasWorkspaceRead(permissions)) {
    return (
      <DashboardLayout>
        <PageHeader title="Verify" subtitle="Проверка RBAC и безопасности" />
        <main className="flex-1 p-6 lg:p-8">
          <StatePanel variant="warning" title="Доступ запрещён" description="Для просмотра требуется право WORKSPACE.READ." />
        </main>
      </DashboardLayout>
    );
  }

  const authz = result?.authz_verification;
  const ledger = result?.ledger_verification;
  const authzOk = authz?.authz_ok === true;
  const ledgerSkipped = ledger && 'skipped' in ledger && ledger.skipped;
  const ledgerOk = ledger && !ledgerSkipped && 'ok' in ledger && ledger.ok;
  const ledgerFailed = ledger && !ledgerSkipped && 'ok' in ledger && !ledger.ok;

  return (
    <DashboardLayout>
      <PageHeader
        title="Verify"
        subtitle="Проверка RBAC, Ledger и безопасности"
        actions={
          <button
            onClick={runVerify}
            disabled={loading}
            className="btn btn-primary disabled:opacity-50"
          >
            {loading ? 'Проверка…' : 'Verify'}
          </button>
        }
      />
      <main className="flex-1 p-6 lg:p-8 space-y-8">
        {/* AuthZ section */}
        <section aria-labelledby="authz-heading">
          <h2 id="authz-heading" className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            AuthZ (RBAC)
          </h2>
          {overallState !== 'idle' && overallState !== 'loading' && (
            <div className="mb-6">
              <StatePanel
                variant={
                  overallState === 'ok'
                    ? 'success'
                    : overallState === 'rate_limit'
                      ? 'warning'
                      : 'error'
                }
                title={
                  overallState === 'ok'
                    ? 'OK'
                    : overallState === 'rate_limit'
                      ? 'Rate limit — попробуйте позже'
                      : 'Failed'
                }
                description={
                  overallState === 'rate_limit'
                    ? 'Превышен лимит запросов (10/мин). Подождите минуту и нажмите Verify.'
                    : authz?.message ?? result?.error ?? 'Internal error'
                }
                actions={
                  (overallState === 'error' || overallState === 'rate_limit') && (
                    <button
                      onClick={runVerify}
                      className="text-sm font-medium underline hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 rounded"
                    >
                      Повторить
                    </button>
                  )
                }
              />
            </div>
          )}

          {result && authz && (overallState === 'ok' || overallState === 'failed') && (
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-semibold">Детали AuthZ</h3>
              </div>
              <div className="card-body">
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  {result.schema_version != null && (
                    <>
                      <div>
                        <dt className="text-slate-500 dark:text-slate-400">schema_version</dt>
                        <dd className="font-mono">{result.schema_version}</dd>
                      </div>
                      {authz.scope && (
                        <>
                          <div>
                            <dt className="text-slate-500 dark:text-slate-400">route_count</dt>
                            <dd className="font-mono">{authz.scope.route_count}</dd>
                          </div>
                          <div>
                            <dt className="text-slate-500 dark:text-slate-400">permission_count</dt>
                            <dd className="font-mono">{authz.scope.permission_count}</dd>
                          </div>
                          <div>
                            <dt className="text-slate-500 dark:text-slate-400">role_count</dt>
                            <dd className="font-mono">{authz.scope.role_count}</dd>
                          </div>
                          <div>
                            <dt className="text-slate-500 dark:text-slate-400">deny_by_default_scope</dt>
                            <dd className="font-mono">{authz.scope.deny_by_default_scope ?? '—'}</dd>
                          </div>
                        </>
                      )}
                      {result.timing_ms && (
                        <div>
                          <dt className="text-slate-500 dark:text-slate-400">timing_ms</dt>
                          <dd className="font-mono">
                            {result.timing_ms.total != null ? `${result.timing_ms.total} ms` : '—'}
                          </dd>
                        </div>
                      )}
                    </>
                  )}
                </dl>
              </div>
            </div>
          )}
        </section>

        {/* Ledger section */}
        <section aria-labelledby="ledger-heading">
          <h2 id="ledger-heading" className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Ledger integrity
          </h2>
          {result === null && overallState === 'idle' ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Нажмите &quot;Verify&quot; для проверки AuthZ и Ledger.
              {!hasLedgerRead(permissions) && ' Ledger будет пропущен (требуется LEDGER.READ).'}
            </p>
          ) : result && overallState !== 'loading' ? (
            <>
              {ledgerSkipped && (
                <div className="mb-6">
                  <StatePanel
                    variant="warning"
                    title="Ledger verification skipped"
                    description={(ledger as { reason?: string }).reason ?? 'LEDGER.READ not granted'}
                  />
                </div>
              )}
              {ledgerFailed && (
                <div className="mb-6">
                  <StatePanel
                    variant="error"
                    title="Failed"
                    description={(ledger as { error?: string }).error ?? 'Ledger verification failed'}
                    actions={
                      <button
                        onClick={runVerify}
                        className="text-sm font-medium underline hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 rounded"
                      >
                        Повторить
                      </button>
                    }
                  />
                </div>
              )}
              {ledgerOk && ledger && 'scope' in ledger && ledger.scope && (
                <div className="card">
                  <div className="card-header">
                    <h3 className="text-lg font-semibold">Детали Ledger</h3>
                  </div>
                  <div className="card-body">
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div>
                        <dt className="text-slate-500 dark:text-slate-400">event_count</dt>
                        <dd className="font-mono">{ledger.scope.event_count}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500 dark:text-slate-400">id_min</dt>
                        <dd className="font-mono">{ledger.scope.id_min ?? '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500 dark:text-slate-400">id_max</dt>
                        <dd className="font-mono">{ledger.scope.id_max ?? '—'}</dd>
                      </div>
                      {result.timing_ms?.ledger != null && (
                        <div>
                          <dt className="text-slate-500 dark:text-slate-400">timing_ms</dt>
                          <dd className="font-mono">{result.timing_ms.ledger} ms</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </section>
      </main>
    </DashboardLayout>
  );
}
