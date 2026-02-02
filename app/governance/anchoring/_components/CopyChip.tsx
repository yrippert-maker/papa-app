'use client';

import * as React from 'react';

export type CopyChipProps = {
  copyKey: string;
  text: string;
  labelDefault: string;
  copyState: { key: string; status: 'ok' | 'error' } | null;
  lockedKey: string | null;
  onCopy: (key: string, text: string) => void;
};

export function CopyChip({
  copyKey,
  text,
  labelDefault,
  copyState,
  lockedKey,
  onCopy,
}: CopyChipProps) {
  const status = copyState?.key === copyKey ? copyState.status : null;
  const isLocked = lockedKey === copyKey;

  const label = status === 'ok' ? '✓' : status === 'error' ? '⚠︎' : labelDefault;

  const title =
    status === 'error' ? 'Copy failed' : status === 'ok' ? 'Copied' : labelDefault;

  const liveText =
    status === 'ok' ? 'Copied to clipboard' : status === 'error' ? 'Copy failed' : '';

  return (
    <button
      type="button"
      onClick={() => void onCopy(copyKey, text)}
      disabled={isLocked}
      className={[
        'rounded-md border px-2 py-0.5 text-[11px]',
        'transition-colors duration-200 ease-out',
        isLocked ? 'opacity-60 cursor-not-allowed' : '',
        status === 'error'
          ? 'border-rose-400 text-rose-700 dark:border-rose-700 dark:text-rose-300'
          : 'hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900',
      ].join(' ')}
      title={title}
      aria-label={title}
    >
      <span
        className={[
          'inline-flex items-center justify-center',
          'transition-transform duration-200 ease-out will-change-transform',
          status === 'ok' ? 'scale-110' : 'scale-100',
        ].join(' ')}
      >
        {label}
      </span>
      <span className="sr-only" aria-live="polite">
        {liveText}
      </span>
    </button>
  );
}
