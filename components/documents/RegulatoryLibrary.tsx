'use client';

import { useEffect, useState, useCallback } from 'react';

interface Doc {
  id: string;
  regulator: string;
  category: string;
  titleEn: string;
  titleRu: string | null;
  annotationRu: string | null;
  edition: string;
  effectiveDate: string | null;
  languages: string[];
  hasRussianOfficial: boolean;
  sourceUrl: string;
  pdfPath: string | null;
  pdfPathRu: string | null;
  tags: string[];
  relevance: string;
}

export function RegulatoryLibrary() {
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [regulators, setRegulators] = useState<Array<{ regulator: string; count: number }>>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterRegulator, setFilterRegulator] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null);
  const [pdfLang, setPdfLang] = useState<'en' | 'ru'>('en');

  const loadDocuments = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterRegulator) params.set('regulator', filterRegulator);
    if (filterCategory) params.set('category', filterCategory);
    params.set('limit', '50');
    fetch(`/api/regulatory-documents?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setDocuments(d.documents ?? []);
        setTotal(d.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [filterRegulator, filterCategory]);

  const searchDocuments = useCallback(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      loadDocuments();
      return;
    }
    setLoading(true);
    const params = new URLSearchParams({ q: searchQuery.trim() });
    if (filterRegulator) params.set('regulator', filterRegulator);
    if (filterCategory) params.set('category', filterCategory);
    params.set('limit', '50');
    fetch(`/api/regulatory-documents/search?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setDocuments(d.documents ?? []);
        setTotal(d.documents?.length ?? 0);
      })
      .finally(() => setLoading(false));
  }, [searchQuery, filterRegulator, loadDocuments]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    fetch('/api/regulatory-documents/regulators')
      .then((r) => r.json())
      .then((d) => setRegulators(d.regulators ?? []));
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchDocuments();
  };

  const relevanceLabel: Record<string, string> = {
    critical: 'Критичный',
    important: 'Важный',
    reference: 'Справочный',
  };

  const categoryLabel: Record<string, string> = {
    annex: 'Annex',
    part: 'Part',
    cfr: 'CFR',
    ac: 'AC',
    car: 'CAR',
    caap: 'CAAP',
    manual: 'Manual',
    guide: 'Guide',
    concept: 'Concept',
    rules: 'Правила',
    pans: 'PANS',
  };

  const pdfUrl = selectedDoc
    ? `/api/regulatory-documents/${selectedDoc.id}/pdf?lang=${pdfLang}`
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-end">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[200px]">
          <input
            type="search"
            placeholder="Поиск по названию, аннотации…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-slate-700 dark:bg-slate-600 text-white hover:bg-slate-600 dark:hover:bg-slate-500"
          >
            Найти
          </button>
        </form>
        <div className="flex gap-2">
          <select
            value={filterRegulator}
            onChange={(e) => setFilterRegulator(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          >
            <option value="">Все регуляторы</option>
            {regulators.map((r) => (
              <option key={r.regulator} value={r.regulator}>
                {r.regulator} ({r.count})
              </option>
            ))}
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          >
            <option value="">Все типы</option>
            {Object.entries(categoryLabel).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-sm text-slate-500 dark:text-slate-400">
        Найдено документов: {total}
      </p>

      {loading ? (
        <div className="py-8 text-center text-slate-500">Загрузка…</div>
      ) : documents.length === 0 ? (
        <div className="py-8 text-center text-slate-500">Документы не найдены</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {doc.regulator} · {categoryLabel[doc.category] ?? doc.category}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    doc.relevance === 'critical'
                      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200'
                      : doc.relevance === 'important'
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {relevanceLabel[doc.relevance] ?? doc.relevance}
                </span>
              </div>
              <h4 className="font-medium text-slate-900 dark:text-white mb-1 line-clamp-2">
                {doc.titleRu || doc.titleEn}
              </h4>
              {doc.annotationRu && (
                <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3 mb-3">
                  {doc.annotationRu}
                </p>
              )}
              <div className="flex flex-wrap gap-1 mb-3">
                {doc.tags.slice(0, 4).map((t) => (
                  <span
                    key={t}
                    className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                  >
                    {t}
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDoc(doc)}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Открыть PDF
                </button>
                <a
                  href={doc.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-slate-500 dark:text-slate-400 hover:underline"
                >
                  Источник
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setSelectedDoc(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-medium text-slate-900 dark:text-white truncate pr-4">
                {selectedDoc.titleRu || selectedDoc.titleEn}
              </h3>
              <div className="flex items-center gap-2">
                {selectedDoc.hasRussianOfficial && (
                  <button
                    type="button"
                    onClick={() => setPdfLang((l) => (l === 'en' ? 'ru' : 'en'))}
                    className="text-sm px-3 py-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
                  >
                    {pdfLang === 'en' ? 'RU' : 'EN'}
                  </button>
                )}
                <a
                  href={selectedDoc.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Открыть на сайте
                </a>
                <button
                  type="button"
                  onClick={() => setSelectedDoc(null)}
                  className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  aria-label="Закрыть"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              {pdfUrl ? (
                <iframe
                  src={pdfUrl}
                  title={selectedDoc.titleEn}
                  className="w-full h-full min-h-[60vh]"
                />
              ) : (
                <div className="p-8 text-center text-slate-500">
                  PDF не загружен. Откройте документ по ссылке на источник.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
