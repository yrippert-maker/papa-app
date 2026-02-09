'use client';

import type { ReactNode } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';

export type PageShellProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  breadcrumb?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
};

/**
 * Unified page layout wrapper: header + breadcrumb + description + content.
 * Replaces repeated layout patterns across pages.
 */
export function PageShell({ title, description, breadcrumb, actions, children }: PageShellProps) {
  return (
    <div className="flex flex-col min-h-0">
      {breadcrumb && (
        <nav className="px-6 lg:px-8 py-2 text-sm text-slate-500 dark:text-slate-400">
          {breadcrumb}
        </nav>
      )}
      <PageHeader title={title} description={description} actions={actions} />
      <main className="flex-1 px-6 lg:px-8 py-6">{children}</main>
    </div>
  );
}
