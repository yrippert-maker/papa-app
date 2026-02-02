'use client';

import * as React from 'react';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
};

export function Modal({ open, onClose, title, children }: ModalProps) {
  React.useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50"
      aria-modal="true"
      role="dialog"
      aria-label={title ?? 'Dialog'}
    >
      <button
        type="button"
        className="absolute inset-0 h-full w-full bg-black/40"
        onClick={onClose}
        aria-label="Close dialog"
      />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-3xl rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 p-3">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {title ?? 'Dialog'}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 dark:border-slate-600 px-2 py-1 text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Close
            </button>
          </div>

          <div className="max-h-[75vh] overflow-auto p-3">{children}</div>
        </div>
      </div>
    </div>
  );
}
