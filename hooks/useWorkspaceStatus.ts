'use client';

import { useCallback, useEffect, useState } from 'react';

const CACHE_TTL_MS = 5000;

export type WorkspaceStatus = {
  workspaceExists: boolean;
  dbExists: boolean;
  schemaReady: boolean;
  filesRegistered: number;
  ledgerEvents: number;
};

type Cached = { data: WorkspaceStatus; ts: number };

let cache: Cached | null = null;
/** Single-flight: reuse in-flight promise to avoid request storms on rapid refetch(). */
let inFlightPromise: Promise<WorkspaceStatus> | null = null;

function fetchStatus(): Promise<WorkspaceStatus> {
  if (inFlightPromise) return inFlightPromise;
  inFlightPromise = fetch('/api/workspace/status')
    .then((r) => {
      if (!r.ok) throw new Error('status failed');
      return r.json();
    })
    .then((d) => ({
      workspaceExists: d.workspaceExists ?? false,
      dbExists: d.dbExists ?? false,
      schemaReady: d.schemaReady ?? false,
      filesRegistered: d.filesRegistered ?? 0,
      ledgerEvents: d.ledgerEvents ?? 0,
    }))
    .finally(() => {
      inFlightPromise = null;
    });
  return inFlightPromise;
}

export function useWorkspaceStatus(): {
  status: WorkspaceStatus | null;
  error: boolean;
  unavailable: boolean;
  stale: boolean;
  refetch: () => void;
} {
  const [status, setStatus] = useState<WorkspaceStatus | null>(null);
  const [error, setError] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [trigger, setTrigger] = useState(0);

  const refetch = useCallback(() => {
    cache = null;
    setTrigger((t) => t + 1);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('workspace-status-invalidate'));
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => setTrigger((t) => t + 1);
    window.addEventListener('workspace-status-invalidate', handler);
    return () => window.removeEventListener('workspace-status-invalidate', handler); // Unsubscribe safety: symmetric add/remove
  }, []);

  useEffect(() => {
    const now = Date.now();
    if (cache && now - cache.ts < CACHE_TTL_MS) {
      setStatus(cache.data);
      setError(false);
      setUnavailable(false);
      return;
    }

    fetchStatus()
      .then((data) => {
        cache = { data, ts: Date.now() };
        setStatus(data);
        setError(false);
        setUnavailable(false);
      })
      .catch(() => {
        setStatus(null);
        setError(true);
        setUnavailable(true);
      });
  }, [trigger]);

  const stale = status !== null && cache !== null && Date.now() - cache.ts >= CACHE_TTL_MS;
  return { status, error, unavailable, stale, refetch };
}
