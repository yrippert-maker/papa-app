'use client';

import type { ReactNode } from 'react';

export type FormFieldProps = {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  htmlFor?: string;
};

/**
 * Form field wrapper with label, error, hint. Reduces boilerplate in forms.
 */
export function FormField({ label, error, hint, required, children, htmlFor }: FormFieldProps) {
  return (
    <div className="space-y-1">
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-slate-700 dark:text-slate-300"
      >
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {hint && !error && <p className="text-sm text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
}
