'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { DocumentsTabs } from '@/components/documents/DocumentsTabs';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

const KNOWN_DOC_IDS = ['finance/payments', 'mura-menasa/handbook'];

export default function DocumentStorePage() {
  const params = useParams();
  const docId = (params?.docId as string[] | undefined)?.join('/') || '';
  const [content, setContent] = useState<unknown>(null);
  const [format, setFormat] = useState<string>('');
  const [versions, setVersions] = useState<Array<{ key: string; size?: number; last_modified?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!docId || !KNOWN_DOC_IDS.includes(docId)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/docs/get?doc_id=${encodeURIComponent(docId)}`).then((r) => r.json()),
      fetch(`/api/docs/versions?doc_id=${encodeURIComponent(docId)}`).then((r) => r.json()),
    ])
      .then(([getRes, versRes]) => {
        if (getRes.ok) {
          setContent(getRes.content);
          setFormat(getRes.format || '');
        } else setError(getRes.error || 'Failed to load document');
        if (versRes.ok) setVersions(versRes.versions || []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false));
  }, [docId]);

  if (!docId || !KNOWN_DOC_IDS.includes(docId)) {
    return (
      <DashboardLayout>
        <main className="p-6 lg:p-8">
          <PageHeader title="Документ" description="Document Store: выберите документ." />
          <DocumentsTabs />
          <p className="text-slate-500 dark:text-slate-400">
            Документы: <Link href="/documents/finance" className="text-blue-600 dark:text-blue-400 hover:underline">Финансы (реестр платежей)</Link>,{' '}
            <Link href="/documents/mura-menasa/handbook" className="text-blue-600 dark:text-blue-400 hover:underline">Mura Menasa (handbook)</Link>.
          </p>
        </main>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <main className="p-6 lg:p-8">
        <PageHeader
          title={docId === 'finance/payments' ? 'Реестр платежей' : docId === 'mura-menasa/handbook' ? 'Mura Menasa — handbook' : docId}
          description={`Document Store: ${docId}. Текущая версия и история.`}
        />
        <DocumentsTabs />
        <div className="mb-4">
          <Link href="/documents" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
            ← Документы
          </Link>
        </div>
        {loading ? (
          <p className="text-slate-500 dark:text-slate-400">Загрузка…</p>
        ) : error ? (
          <p className="text-amber-600 dark:text-amber-400">{error}</p>
        ) : (
          <>
            <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Текущая версия (latest)</h3>
              {format === 'json' && content != null && (
                <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded bg-slate-100 p-3 text-sm dark:bg-slate-900">
                  {JSON.stringify(content, null, 2)}
                </pre>
              )}
              {format === 'markdown' && typeof content === 'string' && (
                <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded bg-slate-100 p-3 text-sm dark:bg-slate-900">
                  {content}
                </pre>
              )}
            </section>
            <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">История версий</h3>
              {versions.length === 0 ? (
                <p className="text-slate-500 dark:text-slate-400 text-sm">Пока нет сохранённых версий.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {versions.map((v) => (
                    <li key={v.key} className="font-mono text-slate-600 dark:text-slate-400">
                      {v.key.split('/').pop()}
                      {v.last_modified && (
                        <span className="ml-2 text-slate-400 dark:text-slate-500">
                          {new Date(v.last_modified).toLocaleString()}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </DashboardLayout>
  );
}
