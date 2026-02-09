'use client';

import Link from 'next/link';

export interface KpiTile {
  label: string;
  value: string | number;
  href: string;
  query?: Record<string, string>;
  icon: React.ReactNode;
  variant?: 'default' | 'warning';
}

export function KpiTiles({ tiles }: { tiles: KpiTile[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
      {tiles.map((t) => {
        const search = t.query ? `?${new URLSearchParams(t.query).toString()}` : '';
        const href = `${t.href}${search}`;
        return (
          <Link
            key={t.label}
            href={href}
            className={`card hover:shadow-md transition-all duration-200 hover:border-[#EF1C23]/40 dark:hover:border-[#EF1C23]/60 ${
              t.variant === 'warning' ? 'border-amber-300 dark:border-amber-600' : ''
            }`}
          >
            <div className="card-body py-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#4a4a4a] dark:text-slate-400 mb-1">{t.label}</p>
                  <p className="text-2xl font-bold text-[#1a1a1a] dark:text-white tabular-nums">
                    {t.value}
                  </p>
                </div>
                <div
                  className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    t.variant === 'warning'
                      ? 'bg-amber-100 dark:bg-amber-900/40'
                      : 'bg-red-50 dark:bg-red-900/20'
                  }`}
                >
                  <span
                    className={
                      t.variant === 'warning'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-[#EF1C23] dark:text-red-400'
                    }
                  >
                    {t.icon}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
