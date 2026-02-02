'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type {
  AnchoringHealth,
  AnchorListResponse,
  AnchorListItem,
  AnchorRowStatus,
  AnchorDetailResponse,
} from '@/lib/types/anchoring';
import { IssuesPanel } from '@/app/governance/anchoring/_components';

type RangePreset = 7 | 30 | 90;

function isoDateOnly(d: Date) {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

function cx(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(' ');
}

function fmtUtc(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    confirmed: { label: '✅ confirmed', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800' },
    empty: { label: '⚪ empty', cls: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
    pending: { label: '⏳ pending', cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800' },
    failed: { label: '❌ failed', cls: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800' },
  };
  const v = map[status] ?? { label: status, cls: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300' };
  return <span className={cx('inline-flex items-center rounded-full border px-2 py-0.5 text-xs', v.cls)}>{v.label}</span>;
}

export default function AnchoringPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const qStatus = (sp.get('status') || '') as AnchorRowStatus | '';
  const qPreset = (sp.get('preset') || '') as string;
  const qFrom = sp.get('from');
  const qTo = sp.get('to');
  const qAnchorId = sp.get('anchorId');

  const preset: RangePreset = qPreset === '7' ? 7 : qPreset === '90' ? 90 : 30;

  const defaultFrom = isoDateOnly(daysAgo(preset));
  const defaultTo = isoDateOnly(new Date());

  const [rangeFrom, setRangeFrom] = useState<string>(qFrom ?? defaultFrom);
  const [rangeTo, setRangeTo] = useState<string>(qTo ?? defaultTo);
  const [status, setStatus] = useState<AnchorRowStatus | ''>(qStatus || '');
  const [health, setHealth] = useState<AnchoringHealth | null>(null);

  const [list, setList] = useState<AnchorListResponse | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedAnchorId, setSelectedAnchorId] = useState<string | null>(qAnchorId);
  const [detail, setDetail] = useState<AnchorDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    const defFrom = isoDateOnly(daysAgo(preset));
    const defTo = isoDateOnly(new Date());
    setRangeFrom(qFrom ?? defFrom);
    setRangeTo(qTo ?? defTo);
    setStatus(qStatus || '');
    setSelectedAnchorId(qAnchorId);
  }, [qFrom, qTo, qStatus, qAnchorId, qPreset, preset]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/anchoring/health', { cache: 'no-store' });
        if (!r.ok) throw new Error(`health ${r.status}`);
        const data = (await r.json()) as AnchoringHealth;
        if (!cancelled) setHealth(data);
      } catch {
        if (!cancelled) setHealth(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setListLoading(true);
      setListError(null);
      try {
        const params = new URLSearchParams();
        params.set('from', rangeFrom);
        params.set('to', rangeTo);
        params.set('limit', '200');
        params.set('offset', '0');
        if (status) params.set('status', status);

        const r = await fetch(`/api/anchoring/anchors?${params.toString()}`, { cache: 'no-store' });
        if (!r.ok) throw new Error(`list ${r.status}`);
        const data = (await r.json()) as AnchorListResponse;
        if (!cancelled) setList(data);
      } catch (e: unknown) {
        if (!cancelled) setListError(e instanceof Error ? e.message : 'failed');
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [rangeFrom, rangeTo, status]);

  useEffect(() => {
    if (!selectedAnchorId) {
      setDetail(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setDetailLoading(true);
      setDetailError(null);
      try {
        const r = await fetch(`/api/anchoring/anchors/${encodeURIComponent(selectedAnchorId)}`, { cache: 'no-store' });
        if (!r.ok) throw new Error(`detail ${r.status}`);
        const data = (await r.json()) as AnchorDetailResponse;
        if (!cancelled) setDetail(data);
      } catch (e: unknown) {
        if (!cancelled) setDetailError(e instanceof Error ? e.message : 'failed');
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [selectedAnchorId]);

  const summary = useMemo(() => {
    const ok = health?.status === 'OK';
    const delayed = health?.status === 'DELAYED';
    const failed = health?.status === 'FAILED';
    const badge = ok ? '✅ OK' : delayed ? '⚠ delayed' : failed ? '❌ failed' : '—';
    return {
      badge,
      last: health?.lastConfirmedAt ? fmtUtc(health.lastConfirmedAt) : '—',
      coverage:
        health
          ? `Last ${health.windowDays ?? 30}d: confirmed ${health.confirmedInWindow}, empty ${health.emptyInWindow}, failed ${health.failedInWindow}`
          : '—',
    };
  }, [health]);

  function updateUrl(next: { preset?: RangePreset; from?: string; to?: string; status?: string; anchorId?: string | null }) {
    const params = new URLSearchParams(sp.toString());

    if (next.preset) params.set('preset', String(next.preset));
    if (next.from) params.set('from', next.from);
    if (next.to) params.set('to', next.to);

    if (typeof next.status !== 'undefined') {
      if (next.status) params.set('status', next.status);
      else params.delete('status');
    }

    if (typeof next.anchorId !== 'undefined') {
      if (next.anchorId) params.set('anchorId', next.anchorId);
      else params.delete('anchorId');
    }

    router.push(`/governance/anchoring?${params.toString()}`);
  }

  function setPreset(p: RangePreset) {
    const from = isoDateOnly(daysAgo(p));
    const to = isoDateOnly(new Date());
    updateUrl({ preset: p, from, to });
  }

  function openAnchor(a: AnchorListItem) {
    setSelectedAnchorId(a.anchorId);
    updateUrl({ anchorId: a.anchorId });
  }

  function closeDrawer() {
    setSelectedAnchorId(null);
    updateUrl({ anchorId: null });
  }

  const statusOptions: Array<{ value: AnchorRowStatus | ''; label: string }> = [
    { value: '', label: 'All' },
    { value: 'confirmed', label: 'confirmed' },
    { value: 'empty', label: 'empty' },
    { value: 'pending', label: 'pending' },
    { value: 'failed', label: 'failed' },
  ];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Anchoring</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Integrity anchoring status and on-chain proofs (Polygon).
          </p>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <IssuesPanel windowDays={30} checkGaps={true} />
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-sm min-w-[320px] bg-white dark:bg-slate-800/50">
            <div className="font-medium text-slate-900 dark:text-white">🔗 Status: {summary.badge}</div>
            <div className="text-slate-500 dark:text-slate-400 mt-0.5">Last confirmed: {summary.last}</div>
            <div className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">{summary.coverage}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex flex-col gap-3 bg-white dark:bg-slate-800/50">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300 mr-2">Range</span>
          {([7, 30, 90] as const).map((p) => (
            <button
              key={p}
              type="button"
              className={cx(
                'rounded-lg border px-3 py-1 text-sm transition-colors',
                preset === p && !qFrom && !qTo
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100'
                  : 'border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'
              )}
              onClick={() => setPreset(p)}
            >
              Last {p}d
            </button>
          ))}
          <div className="flex items-center gap-2 ml-3">
            <label className="text-sm text-slate-500 dark:text-slate-400">From</label>
            <input
              type="date"
              className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm"
              value={rangeFrom}
              onChange={(e) => {
                setRangeFrom(e.target.value);
                updateUrl({ from: e.target.value });
              }}
            />
            <label className="text-sm text-slate-500 dark:text-slate-400">To</label>
            <input
              type="date"
              className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm"
              value={rangeTo}
              onChange={(e) => {
                setRangeTo(e.target.value);
                updateUrl({ to: e.target.value });
              }}
            />
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <label className="text-sm text-slate-500 dark:text-slate-400">Status</label>
            <select
              className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm"
              value={status}
              onChange={(e) => {
                const v = e.target.value as AnchorRowStatus | '';
                setStatus(v);
                updateUrl({ status: v });
              }}
            >
              {statusOptions.map((o) => (
                <option key={o.value || 'all'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-800/50">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="font-medium text-slate-900 dark:text-white">Anchors</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {listLoading ? 'Loading…' : list ? `${list.items.length} items` : '—'}
          </div>
        </div>

        {listError ? (
          <div className="p-4 text-sm text-red-600 dark:text-red-400">Failed to load: {listError}</div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-[980px] w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/80">
                <tr className="text-left">
                  <th className="p-3 font-medium text-slate-700 dark:text-slate-300">Period (UTC)</th>
                  <th className="p-3 font-medium text-slate-700 dark:text-slate-300">Events</th>
                  <th className="p-3 font-medium text-slate-700 dark:text-slate-300">Status</th>
                  <th className="p-3 font-medium text-slate-700 dark:text-slate-300">On-chain</th>
                  <th className="p-3 font-medium text-slate-700 dark:text-slate-300">Contract</th>
                  <th className="p-3 font-medium text-slate-700 dark:text-slate-300">Anchor ID</th>
                </tr>
              </thead>
              <tbody>
                {(list?.items ?? []).map((a) => {
                  const isSelected = a.anchorId === selectedAnchorId;
                  return (
                    <tr
                      key={a.anchorId}
                      className={cx(
                        'border-t border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors',
                        isSelected && 'bg-slate-100 dark:bg-slate-800'
                      )}
                      onClick={() => openAnchor(a)}
                    >
                      <td className="p-3">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {fmtUtc(a.periodStart)} → {fmtUtc(a.periodEnd)}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">created {fmtUtc(a.createdAt)}</div>
                      </td>
                      <td className="p-3 text-slate-700 dark:text-slate-300">{a.eventsCount}</td>
                      <td className="p-3">{statusBadge(a.status)}</td>
                      <td className="p-3">
                        {a.txHash ? (
                          <span className="text-xs font-mono">{a.txHash.slice(0, 10)}…</span>
                        ) : (
                          <span className="text-xs text-slate-500 dark:text-slate-400">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        {a.contractAddress ? (
                          <span className="text-xs font-mono">{a.contractAddress.slice(0, 10)}…</span>
                        ) : (
                          <span className="text-xs text-slate-500 dark:text-slate-400">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="text-xs font-mono text-slate-600 dark:text-slate-400">{a.anchorId}</span>
                      </td>
                    </tr>
                  );
                })}

                {!listLoading && (list?.items?.length ?? 0) === 0 ? (
                  <tr>
                    <td className="p-4 text-sm text-slate-500 dark:text-slate-400" colSpan={6}>
                      No anchors found for the selected filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drawer */}
      <div
        className={cx(
          'fixed top-0 right-0 h-full w-full max-w-[520px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 shadow-xl transition-transform z-50',
          selectedAnchorId ? 'translate-x-0' : 'translate-x-full'
        )}
        aria-hidden={!selectedAnchorId}
      >
        <div className="h-full flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
            <div>
              <div className="font-medium text-slate-900 dark:text-white">Anchor details</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">{selectedAnchorId ?? ''}</div>
            </div>
            <button
              type="button"
              className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={closeDrawer}
            >
              Close
            </button>
          </div>

          <div className="p-4 overflow-auto space-y-4">
            {detailLoading ? (
              <div className="text-sm text-slate-500 dark:text-slate-400">Loading details…</div>
            ) : detailError ? (
              <div className="text-sm text-red-600 dark:text-red-400">Failed to load: {detailError}</div>
            ) : detail ? (
              <>
                <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-sm">
                  <div className="font-medium text-slate-900 dark:text-white mb-2">Summary</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-slate-500 dark:text-slate-400">Status</div>
                    <div>{statusBadge(detail.anchor.status)}</div>

                    <div className="text-slate-500 dark:text-slate-400">Period</div>
                    <div className="text-slate-900 dark:text-white">
                      {fmtUtc(detail.anchor.periodStart)} → {fmtUtc(detail.anchor.periodEnd)}
                    </div>

                    <div className="text-slate-500 dark:text-slate-400">Events</div>
                    <div className="text-slate-900 dark:text-white">{detail.anchor.eventsCount}</div>

                    <div className="text-slate-500 dark:text-slate-400">Merkle root</div>
                    <div className="font-mono text-xs break-all text-slate-700 dark:text-slate-300">
                      {detail.anchor.merkleRoot ?? '—'}
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-sm">
                  <div className="font-medium text-slate-900 dark:text-white mb-2">On-chain proof</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-slate-500 dark:text-slate-400">Network</div>
                    <div className="text-slate-900 dark:text-white">Polygon (137)</div>

                    <div className="text-slate-500 dark:text-slate-400">Contract</div>
                    <div className="font-mono text-xs break-all text-slate-700 dark:text-slate-300">
                      {detail.anchor.contractAddress ?? '—'}
                    </div>

                    <div className="text-slate-500 dark:text-slate-400">Tx hash</div>
                    <div className="font-mono text-xs break-all text-slate-700 dark:text-slate-300">
                      {detail.anchor.txHash ?? '—'}
                    </div>

                    <div className="text-slate-500 dark:text-slate-400">Block / Log</div>
                    <div className="text-slate-900 dark:text-white">
                      {detail.anchor.blockNumber ?? '—'} / {detail.anchor.logIndex ?? '—'}
                    </div>

                    <div className="text-slate-500 dark:text-slate-400">Anchored at</div>
                    <div className="text-slate-900 dark:text-white">{fmtUtc(detail.anchor.anchoredAt)}</div>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!detail.receipt.available || !detail.anchor.txHash}
                      onClick={() => {
                        if (!detail.anchor.anchorId) return;
                        window.open(
                          `/api/anchoring/anchors/${encodeURIComponent(detail.anchor.anchorId)}/receipt`,
                          '_blank'
                        );
                      }}
                    >
                      Open receipt
                    </button>

                    <button
                      type="button"
                      className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                      onClick={async () => {
                        const id = detail.anchor.anchorId;
                        const r = await fetch(
                          `/api/anchoring/anchors/${encodeURIComponent(id)}/proof-bundle`,
                          { cache: 'no-store' }
                        );
                        const j = await r.json();
                        const blob = new Blob([JSON.stringify(j, null, 2)], {
                          type: 'application/json',
                        });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `proof-bundle-${id}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      Export proof bundle
                    </button>
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-sm">
                  <div className="font-medium text-slate-900 dark:text-white mb-2">Verification</div>
                  <div className="space-y-1 text-slate-700 dark:text-slate-300">
                    <div>Signature chain: {detail.verification.signatureChainOk ? '✅ OK' : '❌ FAIL'}</div>
                    <div>Merkle proof: {detail.verification.merkleOk ? '✅ OK' : '❌ FAIL'}</div>
                    <div>On-chain event: {detail.verification.onchainEventOk ? '✅ OK' : '❌ FAIL'}</div>
                    {detail.verification.notes?.length ? (
                      <ul className="mt-2 list-disc pl-5 text-xs text-slate-500 dark:text-slate-400">
                        {detail.verification.notes.map((n, i) => (
                          <li key={i}>{n}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </section>
              </>
            ) : (
              <div className="text-sm text-slate-500 dark:text-slate-400">Select an anchor from the table.</div>
            )}
          </div>
        </div>
      </div>

      {/* drawer backdrop */}
      {selectedAnchorId ? (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={closeDrawer}
          onKeyDown={(e) => e.key === 'Escape' && closeDrawer()}
          role="button"
          tabIndex={0}
          aria-label="Close drawer"
        />
      ) : null}
    </div>
  );
}
