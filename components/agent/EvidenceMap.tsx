'use client';

import { useState } from 'react';

/**
 * Evidence Map — карта источников (документы + чанки).
 * Кликабельный: переход к документу/фрагменту.
 */
export type EvidenceItem = {
  docId: string;
  path: string;
  sha256: string;
  chunkIds: string[];
  snippet?: string;
  confidence?: number;
};

type Props = {
  evidence: EvidenceItem[];
  title?: string;
};

function truncate(s: string, len = 12): string {
  if (s.length <= len) return s;
  return s.slice(0, 6) + '…' + s.slice(-6);
}

function confidenceLabel(c: number): string {
  if (c >= 0.8) return 'Высокая релевантность';
  if (c >= 0.5) return 'Средняя релевантность';
  return 'Низкая релевантность';
}

function confidenceColor(c: number): string {
  if (c >= 0.8) return 'text-emerald-600 dark:text-emerald-400';
  if (c >= 0.5) return 'text-amber-600 dark:text-amber-400';
  return 'text-slate-500 dark:text-slate-400';
}

export function EvidenceMap({ evidence, title = 'Источники' }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!evidence.length) return null;

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 p-3">
      <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
        {title}
      </h4>
      <ul className="space-y-2">
        {evidence.map((e) => (
          <li
            key={e.docId}
            className="text-xs text-slate-600 dark:text-slate-400 font-mono"
          >
            <button
              type="button"
              onClick={() => setExpanded(expanded === e.docId ? null : e.docId)}
              className="w-full text-left flex items-start gap-2 flex-wrap hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded px-2 py-1 -mx-2 -my-1 transition-colors"
              title="Показать фрагмент / открыть документ"
            >
              {typeof e.confidence === 'number' && (
                <span
                  className={`shrink-0 text-xs font-medium ${confidenceColor(e.confidence)}`}
                  title={confidenceLabel(e.confidence)}
                >
                  {(e.confidence * 100).toFixed(0)}%
                </span>
              )}
              <span className="text-slate-500 dark:text-slate-500 truncate max-w-[200px]">
                {e.path || e.docId}
              </span>
              {e.sha256 && (
                <span
                  className="text-slate-400 dark:text-slate-500 shrink-0"
                  title={e.sha256}
                >
                  sha256:{truncate(e.sha256)}
                </span>
              )}
              {e.chunkIds?.length > 0 && (
                <span className="text-slate-400 shrink-0">
                  {e.chunkIds.length} чанк(ов)
                </span>
              )}
              <span className="ml-auto text-blue-500 shrink-0">
                {expanded === e.docId ? '▲' : '▼'}
              </span>
            </button>
            {expanded === e.docId && (
              <div className="mt-2 pl-2 border-l-2 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 bg-white/50 dark:bg-slate-800/50 rounded-r py-2">
                {e.snippet ? (
                  <p className="text-xs whitespace-pre-wrap line-clamp-4">{e.snippet}</p>
                ) : (
                  <p className="text-xs italic">Фрагмент не загружен</p>
                )}
                <a
                  href={`/api/agent/doc/${e.docId}?download=1`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-blue-600 dark:text-blue-400 hover:underline text-xs"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Открыть документ
                </a>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
