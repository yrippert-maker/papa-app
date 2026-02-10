'use client';

import { useCallback, useRef } from 'react';
import { useApiQuery } from './useApiQuery';

export type AuditEvent = {
  id: string;
  action: string;
  actorUserId?: string | null;
  target?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type AuditEventsResponse = {
  events: AuditEvent[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type AuditFilters = {
  action?: string;
  actor?: string;
  from?: string;
  to?: string;
  target?: string;
};

const BATCH_MS = 500;

type QueuedLog = { action: string; target?: string; metadata?: Record<string, unknown> };

/**
 * Audit trail hook: log events (with batching) and getHistory.
 */
export function useAuditTrail(target?: string) {
  const queueRef = useRef<QueuedLog[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    const batch = queueRef.current.splice(0, 10);
    if (batch.length === 0) return;
    for (const item of batch) {
      await fetch('/api/audit/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: item.action,
          target: item.target ?? target,
          metadata: item.metadata,
        }),
      });
    }
  }, [target]);

  const log = useCallback(
    (action: string, metadata?: Record<string, unknown>) => {
      queueRef.current.push({ action, target, metadata });
      if (!timerRef.current) {
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          flush();
        }, BATCH_MS);
      }
    },
    [target, flush]
  );

  return { log, flush };
}

/**
 * Fetch audit history with filters. Uses useApiQuery.
 */
export function useAuditHistory(filters: AuditFilters & { limit?: number; cursor?: string }) {
  const params = new URLSearchParams();
  if (filters.action) params.set('action', filters.action);
  if (filters.actor) params.set('actor', filters.actor);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  params.set('limit', String(filters.limit ?? 50));
  if (filters.cursor) params.set('cursor', filters.cursor);

  const url = `/api/audit/events?${params}`;
  return useApiQuery<AuditEventsResponse>(url);
}
