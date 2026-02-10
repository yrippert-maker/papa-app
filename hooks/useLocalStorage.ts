'use client';

import { useCallback, useState } from 'react';

/**
 * Persistent state via localStorage.
 * For user preferences (theme, sidebar, table settings).
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  options?: { serialize?: (v: T) => string; deserialize?: (s: string) => T }
): [T, (value: T | ((prev: T) => T)) => void] {
  const serialize = options?.serialize ?? JSON.stringify;
  const deserialize = options?.deserialize ?? JSON.parse;

  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? deserialize(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setState((prev) => {
        const next = typeof value === 'function' ? (value as (p: T) => T)(prev) : value;
        try {
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(key, serialize(next));
          }
        } catch {
          // quota exceeded or private mode
        }
        return next;
      });
    },
    [key, serialize]
  );

  return [state, setValue];
}
