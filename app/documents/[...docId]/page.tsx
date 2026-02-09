'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { DocumentsTabs } from '@/components/documents/DocumentsTabs';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

const KNOWN_DOC_IDS = ['finance/payments', 'mura-menasa/handbook'];
const MM_DOC_IDS = ['MM-01', 'MM-02', 'MM-03', 'MM-04'];

function normDocId(docId: string): string {
  if (docId === 'mura-menasa/handbook') return 'mura-menasa/handbook';
  if (docId.startsWith('mura-menasa/')) return docId.slice('mura-menasa/'.length);
  return docId;
}

export default function DocumentStorePage() {
  const params = useParams();
  const docId = (params?.docId as string[] | undefined)?.join('/') || '';
  const apiDocId = normDocId(docId);
  const isKnown = KNOWN_DOC_IDS.includes(docId) || (docId.startsWith('mura-menasa/') && MM_DOC_IDS.includes(apiDocId));
  const [content, setContent] = useState<unknown>(null);
  const [format, setFormat] = useState<string>('');
  const [docTitle, setDocTitle] = useState<string>('');
  const [annotation, setAnnotation] = useState<string>('');
  const [versions, setVersions] = useState<Array<{ key: string; size?: number; last_modified?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!docId || !isKnown) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setAnnotation('');
    Promise.all([
      fetch(`/api/docs/get?doc_id=${encodeURIComponent(apiDocId)}`).then((r) => r.json()),
      fetch(`/api/docs/versions?doc_id=${encodeURIComponent(apiDocId)}`).then((r) => r.json()),
    ])
      .then(([getRes, versRes]) => {
        if (getRes.ok) {
          setContent(getRes.docs ? { store: getRes.doc_id, docs: getRes.docs } : getRes.content);
          setFormat(getRes.format || '');
          if (getRes.title) setDocTitle(getRes.title);
          if (getRes.annotation_ru) setAnnotation(getRes.annotation_ru);
        } else setError(getRes.hint ? `${getRes.error}. ${getRes.hint}` : getRes.error || 'Failed to load document');
        if (versRes.ok) setVersions(versRes.versions || []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false));
  }, [docId]);

  if (!docId || !isKnown) {
    return (
      <DashboardLayout>
        <main className="p-6 lg:p-8">
          <PageHeader title="Документ" />
<p className="text-slate-500 dark:text-slate-400">
  Document Store: выберите документ.
</p>
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
          title={
            docId === 'finance/payments'
              ? 'Реестр платежей'
              : docId === 'mura-menasa/handbook'
                ? 'Mura Menasa — handbook'
                : docTitle || apiDocId || docId
          }
        />
<p className="text-slate-500 dark:text-slate-400">
  {`Document Store: ${docId}. Текущая версия и история.`}
</p>

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
              {format === 'json' && content != null && typeof content === 'object' && 'docs' in content && Array.isArray((content as { docs: unknown[] }).docs) && (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Документы Mura Menasa. Выберите документ для просмотра:
                  </p>
                  <ul className="space-y-2">
                    {((content as { docs: Array<{ doc_id: string; title: string; edition?: string }> }).docs).map((d) => (
                      <li key={d.doc_id}>
                        <Link
                          href={`/documents/mura-menasa/${d.doc_id}`}
                          className="block rounded-lg border border-slate-200 dark:border-slate-600 p-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                          <span className="font-medium text-slate-900 dark:text-white">{d.doc_id}</span>
                          {' — '}
                          <span className="text-slate-700 dark:text-slate-300">{d.title}</span>
                          {d.edition && <span className="text-slate-500 dark:text-slate-400 text-sm ml-2">({d.edition})</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {format === 'json' && content != null && !(typeof content === 'object' && 'docs' in content && Array.isArray((content as { docs?: unknown[] }).docs)) && (
                <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded bg-slate-100 p-3 text-sm dark:bg-slate-900">
                  {JSON.stringify(content, null, 2)}
                </pre>
              )}
              {format === 'markdown' && typeof content === 'string' && (
                <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded bg-slate-100 p-3 text-sm dark:bg-slate-900">
                  {content}
                </pre>
              )}
              {format === 'docx' && (
                <div className="space-y-3">
                  <a
                    href={`/api/v1/docs/download?doc_id=${encodeURIComponent(apiDocId)}`}
                    download
                    className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded font-medium"
                  >
                    ⬇️ Скачать DOCX
                  </a>
                  {annotation && (
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">{annotation}</p>
                  )}
                </div>
              )}
              {format === 'text' && typeof content === 'string' && (
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
