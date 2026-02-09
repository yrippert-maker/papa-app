'use client';

import type { ReactNode } from 'react';

export type TabItem = {
  key: string;
  label: string;
  content: ReactNode;
};

export type TabsProps = {
  tabs: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
};

/**
 * Tab component for settings and multi-section pages.
 */
export function Tabs({ tabs, activeKey, onChange }: TabsProps) {
  return (
    <div className="flex flex-col">
      <div className="border-b border-slate-200 dark:border-slate-700">
        <nav className="flex gap-1" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeKey === tab.key}
              onClick={() => onChange(tab.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeKey === tab.key
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 hover:border-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="py-4">
        {tabs.map((tab) =>
          activeKey === tab.key ? (
            <div key={tab.key} role="tabpanel">
              {tab.content}
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}
