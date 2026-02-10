'use client';

import { useCallback, useState } from 'react';

/**
 * POST/PUT/DELETE mutation hook with loading/error, optimistic updates, toast feedback.
 * Replaces manual fetch+setLoading+setError in forms.
 */
export function useApiMutation<TInput = unknown, TOutput = unknown>(
  url: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'POST'
): {
  mutate: (body?: TInput, opts?: { onSuccess?: (data: TOutput) => void; onError?: (err: Error) => void }) => Promise<TOutput | null>;
  loading: boolean;
  error: Error | null;
  reset: () => void;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const reset = useCallback(() => {
    setError(null);
    setLoading(false);
  }, []);

  const mutate = useCallback(
    async (
      body?: TInput,
      opts?: { onSuccess?: (data: TOutput) => void; onError?: (err: Error) => void }
    ): Promise<TOutput | null> => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
        }

        const data = res.headers.get('content-type')?.includes('application/json')
          ? await res.json()
          : (null as TOutput);

        opts?.onSuccess?.(data);
        return data;
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        opts?.onError?.(e);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [url, method]
  );

  return { mutate, loading, error, reset };
}
