'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatePanel } from '@/components/ui/StatePanel';
import { useSession } from 'next-auth/react';
import { useState, useCallback } from 'react';

type VerifyState = 'idle' | 'loading' | 'ok' | 'failed' | 'skipped' | 'rate_limit' | 'error';

type AuthzVerifyResponse = {
  ok?: boolean;
  schema_version?: number;
  authz_verification?: {
    executed: boolean;
    skipped: boolean;
    authz_ok: boolean | null;
    message: string;
    scope?: {
      route_count: number;
      permission_count: number;
      role_count: number;
      deny_by_default_scope?: string;
    };
  };
  timing_ms?: { total?: number; verify?: number };
  error?: string;
};

function hasWorkspaceRead(permissions: string[]): boolean {
  return permissions.includes('WORKSPACE.READ');
}

export default function SystemVerifyPage() {
  const { data: session } = useSession();
  const permissions = (session?.user as { permissions?: string[] } | undefined)?.permissions ?? [];
  const [state, setState] = useState<VerifyState>('idle');
  const [result, setResult] = useState<AuthzVerifyResponse | null>(null);

  const runVerify = useCallback(() => {
    setState('loading');
    setResult(null);
    fetch('/api/authz/verify')
      .then((r) => {
        if (r.status === 429) {
          setState('rate_limit');
          return null;
        }
        return r.json().then((body: AuthzVerifyResponse) => ({ status: r.status, body }));
      })
      .then((data) => {
        if (!data) return;
        const { status, body } = data;
        setResult(body);
        if (status !== 200) {
          setState(status === 500 ? 'error' : 'failed');
          return;
        }
        const av = body.authz_verification;
        if (av?.skipped || av?.executed === false || av?.authz_ok === null) {
          setState('skipped');
        } else if (av?.authz_ok === true) {
          setState('ok');
        } else {
          setState('failed');
        }
      })
      .catch(() => {
        setState('error');
        setResult(null);
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

  return (
    <DashboardLayout>
      <PageHeader
        title="Verify"
        subtitle="Проверка RBAC и безопасности"
        actions={
          <button
            onClick={runVerify}
            disabled={state === 'loading'}
            className="btn btn-primary disabled:opacity-50"
          >
            {state === 'loading' ? 'Проверка…' : 'Verify access control'}
          </button>
        }
      />
      <main className="flex-1 p-6 lg:p-8">
        {/* Result banner */}
        {state !== 'idle' && state !== 'loading' && (
          <div className="mb-6">
            <StatePanel
              variant={
                state === 'ok'
                  ? 'success'
                  : state === 'skipped' || state === 'rate_limit'
                    ? 'warning'
                    : 'error'
              }
              title={
                state === 'ok'
                  ? 'OK'
                  : state === 'skipped'
                    ? 'Skipped / Unavailable'
                    : state === 'rate_limit'
                      ? 'Rate limit — попробуйте позже'
                      : 'Failed'
              }
              description={
                result?.authz_verification?.message && state !== 'rate_limit'
                  ? result.authz_verification.message
                  : state === 'rate_limit'
                    ? 'Превышен лимит запросов. Подождите минуту и повторите.'
                    : state === 'error'
                      ? 'Internal error'
                      : undefined
              }
              actions={
                (state === 'error' || state === 'rate_limit') && (
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

        {/* Details (read-only) */}
        {result && (state === 'ok' || state === 'failed' || state === 'skipped') && (
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold">Детали проверки</h3>
            </div>
            <div className="card-body">
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {result.schema_version != null && (
                  <>
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">schema_version</dt>
                      <dd className="font-mono">{result.schema_version}</dd>
                    </div>
                    {result.authz_verification?.scope && (
                      <>
                        <div>
                          <dt className="text-slate-500 dark:text-slate-400">route_count</dt>
                          <dd className="font-mono">{result.authz_verification.scope.route_count}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500 dark:text-slate-400">permission_count</dt>
                          <dd className="font-mono">{result.authz_verification.scope.permission_count}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500 dark:text-slate-400">role_count</dt>
                          <dd className="font-mono">{result.authz_verification.scope.role_count}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500 dark:text-slate-400">deny_by_default_scope</dt>
                          <dd className="font-mono">{result.authz_verification.scope.deny_by_default_scope ?? '—'}</dd>
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
      </main>
    </DashboardLayout>
  );
}
