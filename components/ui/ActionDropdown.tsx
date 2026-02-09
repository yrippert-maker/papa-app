'use client';

import { useState, useRef, useEffect } from 'react';

export type ActionItem<T = unknown> = {
  key: string;
  label: string;
  onClick: (row: T) => void;
  variant?: 'danger' | 'warning' | 'neutral';
};

export type ActionDropdownProps<T = unknown> = {
  row: T;
  actions: ActionItem<T>[];
  triggerLabel?: string;
};

const VARIANT_CLASSES: Record<string, string> = {
  danger: 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30',
  warning: 'text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30',
  neutral: 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800',
};

/**
 * Dropdown menu for table row actions (edit, delete, view).
 */
export function ActionDropdown<T>({ row, actions, triggerLabel = '…' }: ActionDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="btn btn-ghost btn-sm px-2"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {triggerLabel}
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-10 min-w-[140px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg py-1"
          role="menu"
        >
          {actions.map((a) => (
            <button
              key={a.key}
              type="button"
              className={`block w-full px-3 py-2 text-left text-sm ${VARIANT_CLASSES[a.variant ?? 'neutral']}`}
              onClick={() => {
                a.onClick(row);
                setOpen(false);
              }}
              role="menuitem"
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
