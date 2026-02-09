'use client';

import type { ReactNode } from 'react';

export type FilterField = {
  key: string;
  label: string;
  type: 'text' | 'date' | 'select';
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  width?: string;
};

export type FilterPanelProps = {
  fields: FilterField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onApply: () => void;
  onReset?: () => void;
  applyLabel?: string;
  resetLabel?: string;
  /** Extra content (e.g. search) */
  extra?: ReactNode;
};

/**
 * Reusable filter panel for audit, compliance, inspection.
 * Date range, status, action type filters.
 */
export function FilterPanel({
  fields,
  values,
  onChange,
  onApply,
  onReset,
  applyLabel = 'Применить',
  resetLabel = 'Сбросить',
  extra,
}: FilterPanelProps) {
  const hasActiveFilters = Object.values(values).some((v) => v !== '');

  return (
    <div className="flex flex-wrap items-end gap-3">
      {fields.map((f) => (
        <div key={f.key} className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{f.label}</label>
          {f.type === 'text' && (
            <input
              type="text"
              placeholder={f.placeholder}
              value={values[f.key] ?? ''}
              onChange={(e) => onChange(f.key, e.target.value)}
              className={`input input-sm ${f.width ?? 'w-36'}`}
            />
          )}
          {f.type === 'date' && (
            <input
              type="date"
              value={values[f.key] ?? ''}
              onChange={(e) => onChange(f.key, e.target.value)}
              className={`input input-sm ${f.width ?? 'w-36'}`}
            />
          )}
          {f.type === 'select' && (
            <select
              value={values[f.key] ?? ''}
              onChange={(e) => onChange(f.key, e.target.value)}
              className={`select select-sm w-full ${f.width ?? 'w-36'} max-w-full`}
            >
              <option value="">Все</option>
              {f.options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
        </div>
      ))}
      {extra}
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary btn-sm" onClick={onApply}>
          {applyLabel}
        </button>
        {onReset && hasActiveFilters && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onReset}>
            {resetLabel}
          </button>
        )}
      </div>
    </div>
  );
}
