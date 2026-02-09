'use client';

export type LoadingOverlayProps = {
  message?: string;
};

/**
 * Full overlay with spinner for page-level loading.
 */
export function LoadingOverlay({ message = 'Загрузка...' }: LoadingOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500"
          aria-hidden
        />
        <p className="text-sm text-slate-600 dark:text-slate-400">{message}</p>
      </div>
    </div>
  );
}
