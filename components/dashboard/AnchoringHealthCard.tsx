'use client';

import React, { useEffect, useState } from 'react';
import type { AnchoringHealth } from '@/lib/types/anchoring';

function fmtUtc(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

export function AnchoringHealthCard() {
  const [data, setData] = useState<AnchoringHealth | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch('/api/anchoring/health', { cache: 'no-store' });
        if (!r.ok) throw new Error(`health ${r.status}`);
        const j = (await r.json()) as AnchoringHealth;
        if (!cancelled) setData(j);
      } catch (e: unknown) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'failed');
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const status = data?.status ?? null;
  const clickable = status === 'FAILED' || status === 'DELAYED';
  const href =
    status === 'FAILED'
      ? '/governance/anchoring?status=failed'
      : '/governance/anchoring';

  const badge =
    status === 'OK'
      ? '✅ OK'
      : status === 'DELAYED'
        ? '⚠ delayed'
        : status === 'FAILED'
          ? '❌ failed'
          : '…';

  const body = (
    <div
      className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-sm bg-white dark:bg-slate-800/50"
      title="Integrity log anchoring status (no documents stored on-chain)."
    >
      <div className="font-medium text-slate-900 dark:text-white">🔗 Anchoring (Polygon): {badge}</div>
      <div className="text-slate-500 dark:text-slate-400 mt-0.5">Last confirmed: {fmtUtc(data?.lastConfirmedAt ?? null)}</div>
      {data ? (
        <div className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
          Last {data.windowDays}d: confirmed {data.confirmedInWindow}, empty {data.emptyInWindow}, failed {data.failedInWindow}
        </div>
      ) : err ? (
        <div className="text-red-600 dark:text-red-400 text-xs mt-0.5">Unavailable: {err}</div>
      ) : (
        <div className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">Loading…</div>
      )}
    </div>
  );

  return clickable ? (
    <a className="block hover:opacity-90 transition-opacity" href={href}>
      {body}
    </a>
  ) : (
    body
  );
}
