'use client';

import { useCallback, useEffect, useState } from 'react';

export type UseApiQueryOptions<T> = {
  /** Initial data before fetch (avoids loading state) */
  initialData?: T;
  /** Refetch on window focus */
  revalidateOnFocus?: boolean;
  /** Callback on error */
  onError?: (err: Error) => void;
  /** Skip fetch (e.g. when URL depends on auth) */
  enabled?: boolean;
};

/**
 * Generic fetch hook with loading/error/data/refetch.
 * Replaces useState+useEffect+fetch in 20+ pages.
 */
export function useApiQuery<T>(
  url: string | null,
  options: UseApiQueryOptions<T> = {}
): {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const { initialData, revalidateOnFocus = false, onError, enabled = true } = options;

  const [data, setData] = useState<T | null>(initialData ?? null);
  const [loading, setLoading] = useState(enabled && !initialData);
  const [error, setError] = useState<Error | null>(null);
  const [trigger, setTrigger] = useState(0);

  const refetch = useCallback(() => setTrigger((t) => t + 1), []);

  useEffect(() => {
    if (!url || !enabled) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
        return r.json();
      })
      .then((json) => {
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      })
      .catch((err) => {
        const e = err instanceof Error ? err : new Error(String(err));
        if (!cancelled) {
          setError(e);
          setData(null);
          onError?.(e);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [url, enabled, trigger, onError]);

  useEffect(() => {
    if (!revalidateOnFocus || !enabled) return;
    const handler = () => refetch();
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }, [revalidateOnFocus, enabled, refetch]);

  return { data, loading, error, refetch };
}
