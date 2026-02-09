'use client';

import { useCallback } from 'react';

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'neutral';
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  loading?: boolean;
};

const VARIANT_BUTTON: Record<string, string> = {
  danger: 'btn-danger',
  warning: 'btn-primary',
  neutral: 'btn-primary',
};

/**
 * Modal confirmation dialog. Replaces window.confirm and inline modals.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  variant = 'neutral',
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmDialogProps) {
  const handleConfirm = useCallback(async () => {
    await onConfirm();
  }, [onConfirm]);

  const btnClass = VARIANT_BUTTON[variant] ?? 'btn-primary';

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        className="mx-4 w-full max-w-md rounded-lg bg-white dark:bg-slate-800 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className="text-lg font-semibold text-slate-900 dark:text-white">
          {title}
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{message}</p>
        <div className="mt-6 flex gap-3 justify-end">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${btnClass}`}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
