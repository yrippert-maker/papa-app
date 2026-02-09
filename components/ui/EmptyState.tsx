'use client';

import type { ReactNode } from 'react';

export type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
};

/**
 * Unified empty state component.
 * Replaces duplicated "Нет данных", "Пусто" patterns across pages.
 */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {icon && (
        <div className="mb-4 text-slate-400 dark:text-slate-500 text-4xl" aria-hidden>
          {icon}
        </div>
      )}
      <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300">{title}</h3>
      {description && (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
