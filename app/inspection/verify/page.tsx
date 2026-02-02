'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatePanel } from '@/components/ui/StatePanel';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useState } from 'react';

const INSPECTION_VIEW_PERMS = ['INSPECTION.VIEW', 'INSPECTION.MANAGE'];

type VerifyResult = {
  ok: boolean;
  content: {
    valid: boolean;
    export_hash: string;
    computed_hash: string;
  };
  signature?: {
    valid: boolean;
    key_id?: string;
    error?: string;
    revocation_reason?: string;
    key_status?: {
      is_active: boolean;
      is_revoked: boolean;
    };
  };
  errors?: string[];
};

export default function VerifyEvidencePage() {
  const { data: session, status } = useSession();
  const [jsonInput, setJsonInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const permissions = (session?.user as { permissions?: string[] } | undefined)?.permissions ?? [];
  const hasInspectionView = INSPECTION_VIEW_PERMS.some((p) => permissions.includes(p));

  const handleVerify = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const exportJson = JSON.parse(jsonInput);
      const res = await fetch('/api/inspection/evidence/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ export_json: exportJson }),
      });

      if (res.status === 429) {
        throw new Error('Слишком много запросов. Подождите минуту.');
      }

      const data = await res.json();
      if (res.ok) {
        setResult(data);
      } else {
        throw new Error(data.error?.message ?? 'Ошибка верификации');
      }
    } catch (e) {
      if (e instanceof SyntaxError) {
        setError('Невалидный JSON. Проверьте формат.');
      } else {
        setError(e instanceof Error ? e.message : 'Ошибка');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result;
      if (typeof content === 'string') {
        setJsonInput(content);
        setResult(null);
        setError(null);
      }
    };
    reader.readAsText(file);
  };

  if (status === 'loading') {
    return (
      <DashboardLayout>
        <PageHeader title="Проверка Evidence" />
        <main className="flex-1 p-6 lg:p-8">
          <StatePanel variant="loading" title="Загрузка..." />
        </main>
      </DashboardLayout>
    );
  }

  if (!hasInspectionView) {
    return (
      <DashboardLayout>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="card max-w-md w-full text-center">
            <div className="card-body">
              <h2 className="text-xl font-semibold text-[#0F172A] dark:text-slate-100 mb-2">Доступ запрещён</h2>
              <p className="text-[#64748B] dark:text-slate-400 mb-4">
                У вас нет прав для проверки evidence (требуется INSPECTION.VIEW).
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

  return (
    <DashboardLayout>
      <PageHeader
        title="Проверка Evidence"
        subtitle="Верификация подписанного экспорта техкарты"
        actions={
          <Link href="/inspection" className="btn btn-ghost btn-sm">
            ← К списку
          </Link>
        }
      />
      <main className="flex-1 p-6 lg:p-8 space-y-6">
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-[#0F172A] dark:text-slate-100">
              Загрузить export.json
            </h3>
            <p className="text-sm text-[#64748B] dark:text-slate-400 mt-1">
              Вставьте JSON из файла export.json или загрузите файл
            </p>
          </div>
          <div className="card-body space-y-4">
            <div>
              <label className="label text-sm">Файл export.json</label>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleFileUpload}
                className="input py-1.5 text-sm"
              />
            </div>

            <div>
              <label className="label text-sm">Или вставьте JSON</label>
              <textarea
                value={jsonInput}
                onChange={(e) => {
                  setJsonInput(e.target.value);
                  setResult(null);
                  setError(null);
                }}
                placeholder='{"schema_version": "1", "export_hash": "...", ...}'
                rows={10}
                className="input py-2 font-mono text-sm w-full"
              />
            </div>

            <button
              onClick={handleVerify}
              disabled={loading || !jsonInput.trim()}
              className="btn btn-primary"
            >
              {loading ? 'Проверка...' : 'Проверить'}
            </button>
          </div>
        </div>

        {error && (
          <StatePanel
            variant="error"
            title={error}
            actions={
              <button onClick={() => setError(null)} className="btn btn-secondary btn-sm">
                Закрыть
              </button>
            }
          />
        )}

        {result && (
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-[#0F172A] dark:text-slate-100 flex items-center gap-2">
                Результат
                {result.ok ? (
                  <span className="badge badge-success">✓ Валидно</span>
                ) : (
                  <span className="badge badge-error">✗ Ошибка</span>
                )}
              </h3>
            </div>
            <div className="card-body space-y-4">
              {/* Content verification */}
              <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                <h4 className="font-medium text-[#0F172A] dark:text-slate-100 mb-2 flex items-center gap-2">
                  Целостность контента
                  {result.content.valid ? (
                    <span className="badge badge-success text-xs">OK</span>
                  ) : (
                    <span className="badge badge-error text-xs">FAIL</span>
                  )}
                </h4>
                <div className="text-sm text-[#64748B] dark:text-slate-400 space-y-1 font-mono">
                  <p>export_hash: {result.content.export_hash}</p>
                  <p>computed: {result.content.computed_hash}</p>
                </div>
              </div>

              {/* Signature verification */}
              {result.signature && (
                <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                  <h4 className="font-medium text-[#0F172A] dark:text-slate-100 mb-2 flex items-center gap-2">
                    Подпись
                    {result.signature.valid ? (
                      <span className="badge badge-success text-xs">OK</span>
                    ) : (
                      <span className="badge badge-error text-xs">
                        {result.signature.error ?? 'FAIL'}
                      </span>
                    )}
                  </h4>
                  <div className="text-sm text-[#64748B] dark:text-slate-400 space-y-1">
                    {result.signature.key_id && (
                      <p>
                        key_id: <code className="font-mono">{result.signature.key_id}</code>
                      </p>
                    )}
                    {result.signature.key_status && (
                      <p>
                        Ключ: {result.signature.key_status.is_active ? 'активен' : 'архивный'}
                        {result.signature.key_status.is_revoked && (
                          <span className="text-red-600 dark:text-red-400 ml-2">
                            (ОТОЗВАН: {result.signature.revocation_reason ?? '—'})
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Errors */}
              {result.errors && result.errors.length > 0 && (
                <div className="p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
                  <h4 className="font-medium text-red-700 dark:text-red-300 mb-2">Ошибки</h4>
                  <ul className="text-sm text-red-600 dark:text-red-400 list-disc list-inside space-y-1">
                    {result.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}
