'use client';

import { ReactNode } from 'react';

export type StatePanelVariant = 'loading' | 'empty' | 'warning' | 'error' | 'success';

const variantStyles: Record<StatePanelVariant, string> = {
  loading: 'bg-slate-50 text-slate-700 dark:bg-slate-800/80 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  empty: 'bg-slate-50 text-slate-600 dark:bg-slate-800/80 dark:text-slate-400 border-slate-200 dark:border-slate-700',
  warning: 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  error: 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800',
  success: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
};

export type StatePanelProps = {
  variant: StatePanelVariant;
  title: string;
  description?: string;
  actions?: ReactNode;
  details?: string;
  role?: 'status' | 'alert';
  'aria-live'?: 'polite' | 'assertive';
};

export function StatePanel({
  variant,
  title,
  description,
  actions,
  details,
  role = 'status',
  'aria-live': ariaLive,
}: StatePanelProps) {
  const liveAttr = variant === 'error' || variant === 'warning' ? 'assertive' : ariaLive ?? 'polite';
  return (
    <div
      className={`rounded-lg border p-4 ${variantStyles[variant]}`}
      role={role}
      aria-live={liveAttr}
      aria-atomic="true"
    >
      <p className="font-medium">{title}</p>
      {description && <p className="text-sm mt-1">{description}</p>}
      {actions && <div className="mt-3">{actions}</div>}
      {details && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer hover:underline">Подробнее</summary>
          <pre className="mt-1 p-2 rounded bg-black/5 dark:bg-white/5 overflow-x-auto text-xs">{details}</pre>
        </details>
      )}
    </div>
  );
}
