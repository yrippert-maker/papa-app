'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
};

type ToastContextValue = {
  toasts: ToastItem[];
  add: (message: string, variant?: ToastVariant, duration?: number) => void;
  remove: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const add = useCallback((message: string, variant: ToastVariant = 'info', duration = 4000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev, { id, message, variant, duration }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts((p) => p.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const remove = useCallback((id: string) => {
    setToasts((p) => p.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, add, remove }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

function ToastContainer() {
  const ctx = useContext(ToastContext);
  if (!ctx) return null;

  const variantClasses: Record<ToastVariant, string> = {
    success: 'bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200',
    error: 'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
    warning: 'bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200',
    info: 'bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {ctx.toasts.map((t) => (
        <div
          key={t.id}
          className={`px-4 py-3 rounded-lg border shadow-lg ${variantClasses[t.variant]} flex items-center justify-between gap-4`}
          role="alert"
        >
          <span>{t.message}</span>
          <button
            type="button"
            className="text-current opacity-70 hover:opacity-100"
            onClick={() => ctx.remove(t.id)}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      add: () => {},
      remove: () => {},
    };
  }
  return { add: ctx.add, remove: ctx.remove };
}
