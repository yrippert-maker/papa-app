'use client';

import Link from 'next/link';
import type { Alert } from '@/lib/alerts-service';

const CATEGORY_ICON: Record<string, string> = {
  SAFETY: '🛡',
  MATERIALS: '⚠',
  REGULATORY: '📄',
  PROCESS: '⚙',
  TRACEABILITY: '🚁',
  GOVERNANCE: '🔗',
};

const SEVERITY_CLASS: Record<string, string> = {
  info: 'border-slate-200 dark:border-slate-700 hover:border-blue-400',
  minor: 'border-amber-200 dark:border-amber-800 hover:border-amber-500',
  major: 'border-orange-300 dark:border-orange-700 hover:border-orange-500',
  critical: 'border-red-300 dark:border-red-700 hover:border-red-500',
};

export function AlertsList({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) {
    return (
      <div className="text-sm text-slate-500 dark:text-slate-400 py-4">
        Нет активных предупреждений
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {alerts.map((a) => {
        const href = a.action.type === 'NAVIGATE'
          ? `${a.action.href}${a.action.query ? `?${new URLSearchParams(a.action.query).toString()}` : ''}`
          : '#';
        const icon = CATEGORY_ICON[a.category] ?? '•';
        const borderClass = SEVERITY_CLASS[a.severity] ?? SEVERITY_CLASS.info;

        return (
          <Link
            key={a.id}
            href={href}
            className={`block p-4 rounded-xl border bg-white dark:bg-slate-800 transition-all ${borderClass}`}
          >
            <div className="flex items-start gap-3">
              <span className="text-lg">{icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 dark:text-white">{a.title}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{a.message}</p>
              </div>
              <svg
                className="w-5 h-5 text-slate-400 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
