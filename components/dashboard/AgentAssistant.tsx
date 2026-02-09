'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { EvidenceMap, type EvidenceItem } from '@/components/agent/EvidenceMap';
import { BiometricSignButton } from '@/components/signature/BiometricSignButton';

type DocDetail = {
  docId: string;
  path: string;
  filename: string;
  sha256?: string;
  chunks: Array<{ chunkId: string; snippet: string }>;
  override?: { exists: boolean; updatedAt?: string; updatedBy?: string; contentPreview?: string };
};

type SearchResult = {
  docId: string;
  title: string;
  path: string;
  score: number;
  confidence?: number;
  snippet: string;
  highlights?: string[];
  source?: 'semantic' | 'keyword';
};

type SearchMode = 'hybrid' | 'semantic' | 'keyword';

type MissingField = { key: string; question: string; suggestion?: string };

type DraftPreview = {
  draftId: string;
  templateKey: string;
  draftFields: Record<string, unknown>;
  missingFields: MissingField[];
  evidence: EvidenceItem[];
  fieldSuggestions?: Record<string, string>;
  warnings: string[];
  status: 'draft' | 'confirmed' | 'final';
};

const DOC_TYPE_OPTIONS = [
  { label: 'Акт (ВК)', value: 'act', intent: 'act' },
  { label: 'Акт (ВыхК)', value: 'act-output', intent: 'act-output' },
  { label: 'Техкарта', value: 'techcard', intent: 'techcard' },
  { label: 'Бланк MM', value: 'mura-menasa-firm-blank', intent: 'mura-menasa-firm-blank' },
  { label: 'Письмо', value: 'letter', intent: 'mura-menasa-firm-blank' },
] as const;
/** При выборе «Письмо» в Draft API передаём intent: mura-menasa-firm-blank */
function intentForApi(uiIntent: IntentType): string {
  return uiIntent === 'letter' ? 'mura-menasa-firm-blank' : uiIntent;
}
const VALID_INTENTS = ['letter', 'act', 'act-output', 'techcard', 'mura-menasa-firm-blank'] as const;
type IntentType = (typeof VALID_INTENTS)[number];

export function AgentAssistant() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [fallbackSource, setFallbackSource] = useState<string | null>(null);
  const [searchMode, setSearchMode] = useState<SearchMode>('hybrid');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [warning, setWarning] = useState<string | null>(null);
  const [draftPreview, setDraftPreview] = useState<DraftPreview | null>(null);
  const [lastExportSha256, setLastExportSha256] = useState<string | null>(null);
  const [intent, setIntent] = useState<IntentType>('act');
  const [actTypeOverride, setActTypeOverride] = useState<string>('');
  const [unitIdOverride, setUnitIdOverride] = useState<string>('');

  useEffect(() => {
    const intentParam = searchParams.get('intent');
    if (intentParam && VALID_INTENTS.includes(intentParam as IntentType)) {
      setIntent(intentParam as IntentType);
    }
    const actType = searchParams.get('act_type');
    if (actType) setActTypeOverride(actType);
    const unitId = searchParams.get('unit_id');
    if (unitId) setUnitIdOverride(unitId);
  }, [searchParams]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [docDetail, setDocDetail] = useState<DocDetail | null>(null);
  const [isDocLoading, setIsDocLoading] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draftContent, setDraftContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveToast, setSaveToast] = useState<string | false>(false);
  const [indexStatus, setIndexStatus] = useState<{ hasDoc: boolean; hasChunks: boolean } | null>(null);
  const [isQueueingIngest, setIsQueueingIngest] = useState(false);
  const [extractedFromPhoto, setExtractedFromPhoto] = useState<Record<string, string>>({});
  const [isExtractingPhoto, setIsExtractingPhoto] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    issues: Array<{ field?: string; code: string; message: string; severity: string }>;
  } | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const { data: session } = useSession();
  const permissions = (session?.user as { permissions?: string[] } | undefined)?.permissions ?? [];
  const canViewDoc = permissions.includes('FILES.LIST') || permissions.includes('DOC.VIEW');
  const canEditDoc = permissions.includes('DOC.EDIT') || permissions.includes('ADMIN.MANAGE_USERS');

  function toggleDoc(docId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  }

  async function handleDocClick(docId: string) {
    if (!canViewDoc) return;
    setSelectedDocId(docId);
    setDocDetail(null);
    setDocError(null);
    setIsEditing(false);
    setDraftContent('');
    setIsDocLoading(true);
    try {
      const res = await fetch(`/api/agent/doc/${encodeURIComponent(docId)}`);
      const data = await res.json();
      if (!res.ok) {
        setDocError(data.error || 'Ошибка загрузки');
        return;
      }
      setDocDetail({
        docId: data.docId,
        path: data.path ?? '',
        filename: data.filename ?? '',
        sha256: data.sha256,
        chunks: data.chunks ?? [],
        override: data.override,
      });
      setIndexStatus(null);
      fetch(`/api/agent/index-status?docId=${encodeURIComponent(docId)}`)
        .then((r) => r.json())
        .then((s) => setIndexStatus({ hasDoc: !!s.hasDoc, hasChunks: !!s.hasChunks }))
        .catch(() => setIndexStatus(null));
    } catch (e) {
      setDocError('Ошибка соединения');
    } finally {
      setIsDocLoading(false);
    }
  }

  async function handleQueueIngest() {
    if (!docDetail) return;
    setIsQueueingIngest(true);
    try {
      const res = await fetch('/api/agent/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId: docDetail.docId }),
      });
      const data = await res.json();
      if (res.ok) {
        setIndexStatus((prev) => (prev ? { ...prev, hasChunks: false } : null));
        setSaveToast('Поставлено в очередь индексации');
        setTimeout(() => setSaveToast(false), 3000);
      } else {
        setDocError(data.error || 'Ошибка постановки в очередь');
      }
    } catch {
      setDocError('Ошибка соединения');
    } finally {
      setIsQueueingIngest(false);
    }
  }

  async function handleEditClick() {
    if (!docDetail || !canEditDoc) return;
    setIsDocLoading(true);
    try {
      const res = await fetch(
        `/api/agent/doc/${encodeURIComponent(docDetail.docId)}?format=text&source=effective`
      );
      const data = await res.json();
      if (!res.ok) {
        setDocError(data.error || 'Ошибка загрузки текста');
        return;
      }
      setDraftContent(String(data.content ?? ''));
      setIsEditing(true);
    } catch (e) {
      setDocError('Ошибка соединения');
    } finally {
      setIsDocLoading(false);
    }
  }

  async function handleSaveDoc() {
    if (!docDetail || !canEditDoc) return;
    setIsSaving(true);
    setDocError(null);
    try {
      const res = await fetch(`/api/agent/doc/${encodeURIComponent(docDetail.docId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: draftContent }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDocError(data.error || 'Ошибка сохранения');
        return;
      }
      setDocDetail((prev) =>
        prev
          ? {
              ...prev,
              override: {
                exists: true,
                updatedAt: data.updatedAt,
                updatedBy: data.updatedBy,
                contentPreview: draftContent.slice(0, 200),
              },
            }
          : null
      );
      setIsEditing(false);
      setSaveToast('Изменения сохранены');
      setTimeout(() => setSaveToast(false), 3000);
    } catch (e) {
      setDocError('Ошибка соединения');
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancelEdit() {
    setIsEditing(false);
    setDraftContent('');
  }

  function openDocDownload(docId: string) {
    window.open(`/api/agent/doc/${encodeURIComponent(docId)}?download=1`, '_blank', 'noopener');
  }

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (!query.trim()) {
      setWarning('Введите поисковый запрос');
      return;
    }
    setIsModalOpen(true);
    setLoading(true);
    setWarning(null);
    setResults([]);
    setSelected(new Set());
    setSelectedDocId(null);
    setDocDetail(null);
    setDocError(null);
    setIsEditing(false);
    setDraftContent('');
    setFallbackSource(null);
    try {
      const res = await fetch('/api/agent/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), topK: 8, mode: searchMode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setWarning(data.error || 'Ошибка поиска');
        return;
      }
      setResults(data.results ?? []);
      setFallbackSource(data.fallbackSource ?? null);
      if (data.warning) setWarning(data.warning);
    } catch (e) {
      const msg = e instanceof SyntaxError ? 'Сервер вернул неверный ответ' : 'Ошибка соединения';
      setWarning(msg + '. Проверьте Network и server logs.');
    } finally {
      setLoading(false);
    }
  }

  async function handlePrepareDraft() {
    const docIds = Array.from(selected);
    const hasExtracted = Object.keys(extractedFromPhoto).length > 0;
    if (docIds.length === 0 && !hasExtracted) {
      setWarning('Выберите документы или загрузите фото акта');
      return;
    }
    setLoading(true);
    setWarning(null);
    setDraftPreview(null);
    setLastExportSha256(null);
    try {
      const docScores: Record<string, number> = {};
      for (const docId of docIds) {
        const maxScore = Math.max(
          ...results.filter((r) => r.docId === docId).map((r) => r.confidence ?? r.score ?? 0),
          0
        );
        if (maxScore > 0) docScores[docId] = Math.min(1, maxScore);
      }
      const draftRes = await fetch('/api/agent/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: intentForApi(intent),
          instructions:
            query ||
            (intent === 'act' ? 'Сформировать акт ВК' : intent === 'act-output' ? 'Сформировать акт ВыхК' : intent === 'techcard' ? 'Сформировать техкарту' : intent === 'mura-menasa-firm-blank' ? 'Документ на бланке MM' : 'Сформировать письмо'),
          selectedDocIds: docIds,
          docScores: Object.keys(docScores).length > 0 ? docScores : undefined,
          extractedFromImage: hasExtracted ? extractedFromPhoto : undefined,
          ...((intent === 'act' || intent === 'act-output') && actTypeOverride && { actTypeOverride }),
          ...(intent === 'techcard' && unitIdOverride && { unitIdOverride }),
        }),
      });
      const draft = await draftRes.json();
      if (!draftRes.ok) {
        setWarning(draft.error || 'Ошибка черновика');
        return;
      }
      setDraftPreview({
        draftId: draft.draftId,
        templateKey: draft.templateKey ?? 'letter',
        draftFields: draft.draftFields ?? {},
        missingFields: draft.missingFields ?? [],
        evidence: draft.evidence ?? [],
        fieldSuggestions: draft.fieldSuggestions,
        warnings: draft.warnings ?? [],
        status: 'draft',
      });
      if (draft.warnings?.length) setWarning(draft.warnings[0]);
      setExtractedFromPhoto({});
    } catch (e) {
      const msg = e instanceof SyntaxError ? 'Сервер вернул неверный ответ' : 'Ошибка соединения';
      setWarning(msg + '. Проверьте Network и server logs.');
    } finally {
      setLoading(false);
    }
  }

  function updateDraftField(key: string, value: unknown) {
    if (!draftPreview) return;
    setDraftPreview({
      ...draftPreview,
      draftFields: { ...draftPreview.draftFields, [key]: value },
    });
    setValidationResult(null);
  }

  async function handleValidate() {
    if (!draftPreview) return;
    setIsValidating(true);
    setValidationResult(null);
    try {
      const res = await fetch('/api/agent/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: draftPreview.templateKey === 'mura-menasa-firm-blank' ? 'mura-menasa-firm-blank' : draftPreview.templateKey === 'techcard' ? 'techcard' : draftPreview.templateKey === 'act-output' ? 'act-output' : draftPreview.templateKey === 'act' ? 'act' : 'letter',
          draftFields: draftPreview.draftFields,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setValidationResult({ valid: data.valid, issues: data.issues ?? [] });
      } else {
        setWarning(data.error || 'Ошибка валидации');
      }
    } catch (e) {
      setWarning(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setIsValidating(false);
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      setWarning('Только PNG, JPG');
      return;
    }
    setIsExtractingPhoto(true);
    setWarning(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/agent/extract-from-image', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setWarning(data.error || 'Ошибка распознавания');
        return;
      }
      setExtractedFromPhoto(data.extracted ?? {});
      if (Object.keys(data.extracted ?? {}).length > 0) {
        setWarning(null);
      } else if (data.source === 'placeholder') {
        setWarning('Задайте OPENAI_API_KEY для распознавания фото.');
      } else {
        setWarning('Поля не распознаны на фото.');
      }
    } catch (err) {
      setWarning(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setIsExtractingPhoto(false);
      e.target.value = '';
    }
  }

  const canPrepareDraft =
    intent === 'act' || intent === 'act-output' || intent === 'mura-menasa-firm-blank'
      ? selected.size > 0 || Object.keys(extractedFromPhoto).length > 0
      : selected.size > 0;

  async function handleConfirm() {
    if (!draftPreview) return;
    setLoading(true);
    setWarning(null);
    try {
      const res = await fetch('/api/agent/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId: draftPreview.draftId,
          draftFields: draftPreview.draftFields,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setWarning(data.error || 'Ошибка подтверждения');
        return;
      }
      setDraftPreview({ ...draftPreview, status: 'confirmed' });
    } catch (e) {
      const msg = e instanceof SyntaxError ? 'Сервер вернул неверный ответ' : 'Ошибка соединения';
      setWarning(msg + '. Проверьте Network и server logs.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadDocx() {
    if (!draftPreview) return;
    setLoading(true);
    setWarning(null);
    try {
      const exportRes = await fetch('/api/agent/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId: draftPreview.draftId,
          format: 'docx',
          templateKey: draftPreview.templateKey,
          draftFields: draftPreview.draftFields,
        }),
      });
      if (!exportRes.ok) {
        const err = await exportRes.json();
        setWarning(err.error || 'Ошибка экспорта');
        return;
      }
      const sha256 = exportRes.headers.get('X-Docx-Sha256');
      if (sha256) setLastExportSha256(sha256);
      const blob = await exportRes.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `generated-${draftPreview.draftId}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      const msg = e instanceof SyntaxError ? 'Сервер вернул неверный ответ' : 'Ошибка соединения';
      setWarning(msg + '. Проверьте Network и server logs.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="card-header py-4">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          Помощник по документам
        </h3>
      </div>
      <div className="card-body py-4 space-y-4">
        <form
          onSubmit={(e) => handleSearch(e)}
          className="flex gap-2"
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти документ (пилот: TV3-117)"
            className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? '…' : 'Найти'}
          </button>
          <Link
            href="/ai-inbox"
            className="btn btn-secondary flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            Загрузить
          </Link>
        </form>
        {warning && !isModalOpen && (
          <p className="text-sm text-amber-600 dark:text-amber-400">{warning}</p>
        )}
        {isModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={() => setIsModalOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="assistant-dialog-title"
          >
            <div
              className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                <h2 id="assistant-dialog-title" className="text-lg font-semibold text-slate-900 dark:text-white">
                  Помощник по документам
                </h2>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300"
                  aria-label="Закрыть"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Запрос: <strong className="text-slate-900 dark:text-white">{query}</strong>
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Режим:</span>
                    <select
                      value={searchMode}
                      onChange={(e) => setSearchMode(e.target.value as SearchMode)}
                      className="text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                    >
                      <option value="hybrid">Гибрид</option>
                      <option value="semantic">По смыслу</option>
                      <option value="keyword">По имени</option>
                    </select>
                  </div>
                </div>
                {loading && (
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Поиск документов…</span>
                  </div>
                )}
                {warning && isModalOpen && (
                  <p className="text-sm text-amber-600 dark:text-amber-400">{warning}</p>
                )}
                {!loading && results.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Найдено: {results.length}
                  </p>
                  {fallbackSource === 'keyword' && (
                    <span className="text-xs px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200">
                      Совпадение по имени файла
                    </span>
                  )}
                </div>
                <select
                  value={intent}
                  onChange={(e) => setIntent(e.target.value as IntentType)}
                  className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                >
                  {DOC_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {(intent === 'act' || intent === 'act-output' || intent === 'mura-menasa-firm-blank') && (
                  <>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg"
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={loading || isExtractingPhoto}
                      className="btn btn-secondary text-sm flex items-center gap-1"
                    >
                      {isExtractingPhoto ? '…' : '📷'}
                      {Object.keys(extractedFromPhoto).length > 0
                        ? `Фото (${Object.keys(extractedFromPhoto).length})`
                        : 'Фото акта'}
                    </button>
                  </>
                )}
                <button
                  onClick={handlePrepareDraft}
                  disabled={loading || !canPrepareDraft}
                  className="btn btn-secondary text-sm"
                >
                  Подготовить черновик ({selected.size || (Object.keys(extractedFromPhoto).length > 0 ? 'фото' : 0)})
                </button>
              </div>
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {results.map((r) => (
                  <li
                    key={r.docId + r.path}
                    className={`p-3 rounded-lg border transition-colors ${
                      selected.has(r.docId)
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
                        : selectedDocId === r.docId
                          ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600'
                          : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={selected.has(r.docId)}
                        onChange={() => toggleDoc(r.docId)}
                        className="mt-1"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-slate-900 dark:text-white truncate">
                            {r.title}
                          </span>
                          {typeof r.confidence === 'number' && (
                            <span
                              className={`text-xs font-medium shrink-0 ${
                                r.confidence >= 0.8
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : r.confidence >= 0.5
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-slate-500'
                              }`}
                              title="Релевантность запросу"
                            >
                              {(r.confidence * 100).toFixed(0)}%
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {r.path}
                        </div>
                        {r.snippet && (
                          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">
                            {r.snippet}
                          </p>
                        )}
                        {canViewDoc && (
                          <button
                            type="button"
                            onClick={() => handleDocClick(r.docId)}
                            className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Открыть
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50/50 dark:bg-slate-800/30 min-h-[200px]">
              {selectedDocId && (
                <>
                  {isDocLoading && (
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Загрузка…</span>
                    </div>
                  )}
                  {docError && !isDocLoading && (
                    <p className="text-sm text-amber-600 dark:text-amber-400">{docError}</p>
                  )}
                  {docDetail && !isDocLoading && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-medium text-slate-900 dark:text-white truncate">
                          {docDetail.filename}
                        </h4>
                        <div className="flex flex-wrap gap-2 shrink-0">
                          {!isEditing && (
                            <>
                              <button
                                type="button"
                                onClick={() => openDocDownload(docDetail.docId)}
                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                Скачать
                              </button>
                              {(indexStatus?.hasDoc && !indexStatus?.hasChunks) && (
                                <button
                                  type="button"
                                  onClick={handleQueueIngest}
                                  disabled={isQueueingIngest}
                                  className="text-xs px-2 py-1 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-800/50 disabled:opacity-50"
                                >
                                  {isQueueingIngest ? '…' : 'Поставить в очередь индексации'}
                                </button>
                              )}
                              {docDetail.override?.exists && (
                                <button
                                  type="button"
                                  onClick={handleQueueIngest}
                                  disabled={isQueueingIngest}
                                  title="Обновить поиск по изменённой версии"
                                  className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50"
                                >
                                  {isQueueingIngest ? '…' : 'Переиндексировать'}
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={!canEditDoc}
                                title={!canEditDoc ? 'Нет права на редактирование' : undefined}
                                onClick={handleEditClick}
                                className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Редактировать
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {docDetail.path}
                      </p>
                      {isEditing ? (
                        <div className="space-y-2">
                          <textarea
                            value={draftContent}
                            onChange={(e) => setDraftContent(e.target.value)}
                            className="w-full min-h-[200px] px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-mono resize-y"
                            placeholder="Текст документа…"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={handleSaveDoc}
                              disabled={isSaving}
                              className="text-sm px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {isSaving ? 'Сохранение…' : 'Сохранить'}
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              disabled={isSaving}
                              className="text-sm px-3 py-1.5 rounded border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
                            >
                              Отмена
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                          {docDetail.chunks.map((c) => c.snippet).join('\n\n') || '—'}
                        </div>
                      )}
                      {saveToast && (
                        <div className="fixed bottom-4 right-4 z-50 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm shadow-lg">
                          {saveToast}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
              {!selectedDocId && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Нажмите «Открыть» у документа для просмотра
                </p>
              )}
            </div>
          </div>
                )}
                {!loading && draftPreview && (
          <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-700">
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Черновик
            </h4>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 p-3 space-y-3">
              {Object.entries(draftPreview.draftFields).map(([key, val]) => (
                <div key={key} className="flex flex-col gap-1">
                  <label className="text-xs text-slate-500 dark:text-slate-400">
                    {key}
                  </label>
                  {key === 'items' && Array.isArray(val) ? (
                    <span className="text-sm text-slate-600 dark:text-slate-300">
                      {val.length} позиций
                    </span>
                  ) : (
                    <input
                      type="text"
                      value={String(val ?? '')}
                      onChange={(e) => updateDraftField(key, e.target.value)}
                      disabled={draftPreview.status === 'confirmed'}
                      className="px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                    />
                  )}
                </div>
              ))}
              {draftPreview.missingFields.map((mf) => (
                <div key={mf.key} className="flex flex-col gap-1">
                  <label className="text-xs text-amber-600 dark:text-amber-400">
                    {mf.question}
                    {mf.suggestion && (
                      <span className="ml-1 text-emerald-600 dark:text-emerald-400 font-normal">
                        (подсказка из документа)
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={String(draftPreview.draftFields[mf.key] ?? '')}
                    onChange={(e) => updateDraftField(mf.key, e.target.value)}
                    disabled={draftPreview.status === 'confirmed'}
                    placeholder={mf.suggestion ? `Найдено: ${mf.suggestion}` : `Введите ${mf.key}`}
                    className="px-2 py-1.5 rounded border border-amber-300 dark:border-amber-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                  />
                </div>
              ))}
            </div>
            <EvidenceMap evidence={draftPreview.evidence} />
            {draftPreview.warnings.length > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {draftPreview.warnings[0]}
              </p>
            )}
            {draftPreview.status === 'draft' && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleValidate}
                  disabled={isValidating}
                  className="text-sm px-3 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                >
                  {isValidating ? '…' : 'Проверить по правилам'}
                </button>
                {validationResult && (
                  <div className={`rounded p-2 text-sm ${validationResult.valid ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200'}`}>
                    {validationResult.valid ? '✓ Документ соответствует правилам' : 'Обнаружены замечания:'}
                    {!validationResult.valid && validationResult.issues.length > 0 && (
                      <ul className="mt-1 list-disc list-inside text-xs">
                        {validationResult.issues.map((i, idx) => (
                          <li key={idx}>{i.field ? `${i.field}: ` : ''}{i.message}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-2">
              {draftPreview.status === 'draft' && (
                <button
                  onClick={handleConfirm}
                  disabled={loading}
                  className="btn btn-secondary"
                >
                  Подтвердить
                </button>
              )}
              <div className="flex flex-col gap-1">
                <div className="flex gap-2">
                  <button
                    onClick={handleDownloadDocx}
                    disabled={loading || draftPreview.status === 'draft'}
                    title={draftPreview.status === 'draft' ? 'Сначала подтвердите черновик' : undefined}
                    className="btn btn-primary"
                  >
                    Скачать DOCX
                  </button>
                  {lastExportSha256 && (
                    <BiometricSignButton
                      documentHash={lastExportSha256}
                      onSuccess={() => setWarning(null)}
                      onError={setWarning}
                    />
                  )}
                </div>
                {lastExportSha256 && (
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono" title="sha256 документа">
                    sha256:{lastExportSha256.slice(0, 16)}…
                  </span>
                )}
              </div>
            </div>
          </div>
                )}
                {!loading && results.length === 0 && !draftPreview && (
                  <div className="text-sm text-slate-500 dark:text-slate-400 space-y-3">
                    <p>Документы не найдены в индексе.</p>
                    <ul className="text-xs space-y-1 list-disc list-inside">
                      <li>Попробуйте режим <strong>По имени</strong> — для номеров и идентификаторов (TB3-117)</li>
                      <li>Номер без дефисов: <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">TB3117</code></li>
                      <li>Ключевые слова из текста документа</li>
                      <li>Запустите индексацию: <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">npm run docs:index:pgvector</code></li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
