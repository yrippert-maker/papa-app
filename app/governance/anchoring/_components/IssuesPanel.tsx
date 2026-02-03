'use client';

import * as React from 'react';
import type { AnchoringIssuesResponse, AnchoringIssue } from '@/lib/types/anchoring-issues';
import { Modal } from './Modal';
import { CopyChip } from './CopyChip';

type Props = {
  windowDays?: number;
  checkGaps?: boolean;
  className?: string;
};

function bySeverityThenDate(a: AnchoringIssue, b: AnchoringIssue) {
  const sevRank = (s: AnchoringIssue['severity']) => (s === 'critical' ? 0 : 1);
  const r = sevRank(a.severity) - sevRank(b.severity);
  if (r !== 0) return r;

  const da = a.periodStart ? Date.parse(a.periodStart) : 0;
  const db = b.periodStart ? Date.parse(b.periodStart) : 0;
  return db - da;
}

function pillClass(sev: AnchoringIssue['severity']) {
  return sev === 'critical'
    ? 'bg-red-100 text-red-900 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-900/40'
    : 'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900/40';
}

function copyHighlightClass(
  sev: AnchoringIssue['severity'],
  status: 'ok' | 'error'
) {
  if (status === 'error') {
    return [
      'border border-rose-300',
      'bg-rose-50 text-rose-900',
      'ring-1 ring-rose-300/60',
      'dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200 dark:ring-rose-800/40',
    ].join(' ');
  }

  // ok path: critical -> amber, major -> emerald
  if (sev === 'critical') {
    return [
      'border border-amber-300',
      'bg-amber-50 text-amber-900',
      'ring-1 ring-amber-300/60',
      'dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200 dark:ring-amber-800/40',
    ].join(' ');
  }

  return [
    'border border-emerald-300',
    'bg-emerald-50 text-emerald-800',
    'ring-1 ring-emerald-300/60',
    'dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200 dark:ring-emerald-800/40',
  ].join(' ');
}

function normalize(s: string) {
  return s.trim().toLowerCase();
}

function matchesSearch(issue: AnchoringIssue, q: string) {
  if (!q) return true;
  const hay = [
    issue.type,
    issue.severity,
    issue.message,
    issue.txHash ?? '',
    issue.anchorId ?? '',
    issue.periodStart ?? '',
    issue.periodEnd ?? '',
  ]
    .join(' | ')
    .toLowerCase();

  return hay.includes(q);
}

const ACK_PREFIX = 'anchoring-ack:';

function getLocalAck(id: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACK_PREFIX + id);
}

function setLocalAck(id: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACK_PREFIX + id, Date.now().toString());
}

/** Server ack record (from issue-ack-server) */
type ServerAck = { ack_by: string; expires_at?: string | null } | null;

function download(filename: string, text: string, mime = 'application/json') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function copyToClipboard(text: string) {
  // 1) Preferred: async Clipboard API
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // fall through to legacy path
  }

  // 2) Fallback: hidden textarea + execCommand("copy")
  // Works in more cases (incl. some Safari / non-secure contexts), when triggered by user gesture.
  if (typeof document === 'undefined') throw new Error('document unavailable');

  const ta = document.createElement('textarea');
  ta.value = text;

  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.top = '-1000px';
  ta.style.left = '-1000px';
  ta.style.opacity = '0';
  ta.style.pointerEvents = 'none';

  document.body.appendChild(ta);

  ta.focus();
  ta.select();
  ta.setSelectionRange(0, ta.value.length);

  const ok = document.execCommand && document.execCommand('copy');
  document.body.removeChild(ta);

  if (!ok) throw new Error('execCommand copy failed');
}

function useCopyFeedback(timeoutMs = 1500) {
  const [state, setState] = React.useState<{
    key: string;
    status: 'ok' | 'error';
  } | null>(null);

  const [lockedKey, setLockedKey] = React.useState<string | null>(null);

  const timer = React.useRef<number | null>(null);

  const clear = React.useCallback(() => {
    setState(null);
    setLockedKey(null);
  }, []);

  const trigger = React.useCallback(
    (key: string, status: 'ok' | 'error') => {
      setState({ key, status });
      setLockedKey(key);

      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => clear(), timeoutMs);
    },
    [timeoutMs, clear]
  );

  React.useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  return {
    state,
    lockedKey,
    triggerOk: (key: string) => trigger(key, 'ok'),
    triggerError: (key: string) => trigger(key, 'error'),
  };
}

export function IssuesPanel({ windowDays = 30, checkGaps = true, className }: Props) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [data, setData] = React.useState<AnchoringIssuesResponse | null>(null);

  const [criticalOnly, setCriticalOnly] = React.useState(false);
  const [hideGaps, setHideGaps] = React.useState(false);
  const [hideAcknowledged, setHideAcknowledged] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [ackVersion, setAckVersion] = React.useState(0);
  const [groupBy, setGroupBy] = React.useState<'none' | 'type' | 'severity' | 'anchorId'>('none');
  const [collapsedGroups, setCollapsedGroups] = React.useState<Set<string>>(new Set());

  const { state: copyState, lockedKey, triggerOk, triggerError } = useCopyFeedback(1500);

  const load = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const qs = new URLSearchParams({
        windowDays: String(windowDays),
        checkGaps: String(checkGaps),
      });
      const res = await fetch(`/api/anchoring/issues?${qs.toString()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as AnchoringIssuesResponse;
      json.issues = [...(json.issues ?? [])].sort(bySeverityThenDate);
      setData(json);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'failed to load');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [windowDays, checkGaps]);

  React.useEffect(() => {
    if (open && !data && !loading && !err) void load();
  }, [open, data, loading, err, load]);

  React.useEffect(() => {
    const issues = data?.issues ?? [];
    const fps = [...new Set(issues.map((i) => i._fingerprint).filter(Boolean))] as string[];
    if (fps.length === 0) return;
    let cancelled = false;
    const map: Record<string, ServerAck> = {};
    Promise.all(
      fps.map((fp) =>
        fetch(`/api/anchoring/ack?fingerprint=${encodeURIComponent(fp)}`, { cache: 'no-store' })
          .then((r) => r.json())
          .then((j) => {
            if (!cancelled && j?.ack) map[fp] = { ack_by: j.ack.ack_by, expires_at: j.ack.expires_at ?? undefined };
          })
          .catch(() => {})
      )
    ).then(() => {
      if (!cancelled) setServerAckMap((prev) => ({ ...prev, ...map }));
    });
    return () => {
      cancelled = true;
    };
  }, [data?.issues]);

  const counts = React.useMemo(() => {
    const issues = data?.issues ?? [];
    let critical = 0;
    let major = 0;
    for (const i of issues) {
      if (i.severity === 'critical') critical++;
      else major++;
    }
    return { total: issues.length, critical, major };
  }, [data]);

  const q = React.useMemo(() => normalize(search), [search]);

  const filtered = React.useMemo(() => {
    const issues = data?.issues ?? [];
    return issues.filter((i) => {
      if (criticalOnly && i.severity !== 'critical') return false;
      if (hideGaps && i.type === 'GAP_IN_PERIODS') return false;
      if (hideAcknowledged && isAcked(i)) return false;
      if (!matchesSearch(i, q)) return false;
      return true;
    });
    // ackVersion forces re-run when user acknowledges (localStorage changes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, criticalOnly, hideGaps, hideAcknowledged, q, ackVersion, isAcked]);

  const onReset = React.useCallback(() => {
    setCriticalOnly(false);
    setHideGaps(false);
    setHideAcknowledged(false);
    setSearch('');
  }, []);

  const onExportJson = React.useCallback(() => {
    const payload = { ...data, issues: filtered };
    download('anchoring-issues.json', JSON.stringify(payload, null, 2));
  }, [data, filtered]);

  const onExportCsv = React.useCallback(() => {
    const headers = ['id', 'type', 'severity', 'message', 'periodStart', 'periodEnd', 'anchorId', 'txHash', 'actionHref'];
    const rows = filtered.map((i) =>
      headers.map((h) => {
        const v = (i as unknown as Record<string, unknown>)[h] ?? '';
        return typeof v === 'string' && (v.includes(',') || v.includes('"')) ? `"${v.replace(/"/g, '""')}"` : v;
      }).join(',')
    );
    download('anchoring-issues.csv', [headers.join(','), ...rows].join('\n'), 'text/csv');
  }, [filtered]);

  const allTxHashes = React.useMemo(
    () => Array.from(new Set(filtered.map((i) => i.txHash).filter(Boolean))) as string[],
    [filtered]
  );

  const allLinks = React.useMemo(
    () => filtered.map((i) => i.actionHref).filter(Boolean).join('\n'),
    [filtered]
  );

  const uniqueAnchorsCount = React.useMemo(
    () => new Set(filtered.map((i) => i.anchorId).filter(Boolean)).size,
    [filtered]
  );

  type GroupKey = 'none' | 'type' | 'severity' | 'anchorId';
  const grouped = React.useMemo(() => {
    if (groupBy === 'none') return [{ key: '_', issues: filtered }];
    const m = new Map<string, AnchoringIssue[]>();
    for (const i of filtered) {
      const k = groupBy === 'anchorId' ? (i.anchorId ?? '—') : (groupBy === 'type' ? i.type : i.severity);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(i);
    }
    return Array.from(m.entries()).map(([key, issues]) => ({ key, issues }));
  }, [filtered, groupBy]);

  const toggleGroup = React.useCallback((key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const onAck = React.useCallback(
    async (i: AnchoringIssue) => {
      if (i._fingerprint) {
        const ackBy = window.prompt('Ack by (name/email):')?.trim() ?? '';
        if (!ackBy) return;
        const ackReason = window.prompt('Reason (optional):')?.trim() ?? '';
        const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
        try {
          const res = await fetch('/api/anchoring/ack', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fingerprint: i._fingerprint,
              pack_sha256: null,
              ack_by: ackBy,
              ack_reason: ackReason || undefined,
              expires_at: expiresAt,
            }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const j = await res.json();
          if (j?.ok)
            setServerAckMap((prev) => ({
              ...prev,
              [i._fingerprint!]: { ack_by: ackBy, expires_at: expiresAt },
            }));
          setAckVersion((v) => v + 1);
        } catch (e) {
          console.error(e);
          window.alert('Failed to acknowledge');
        }
      } else {
        setLocalAck(i.id);
        setAckVersion((v) => v + 1);
      }
    },
    []
  );

  const onCopy = React.useCallback(
    async (key: string, text: string) => {
      // если уже залочено — игнорируем повторный клик
      if (lockedKey === key) return;

      try {
        await copyToClipboard(text);
        triggerOk(key);
      } catch {
        triggerError(key);
      }
    },
    [lockedKey, triggerOk, triggerError]
  );

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
      >
        View issues ({windowDays}d)
        {data && (
          <span className="ml-1 inline-flex items-center gap-1">
            {counts.critical > 0 && (
              <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">
                {counts.critical} critical
              </span>
            )}
            {counts.major > 0 && (
              <span className="rounded-full bg-amber-600 px-2 py-0.5 text-xs text-white">
                {counts.major} major
              </span>
            )}
            {counts.total === 0 && (
              <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs text-white">
                0
              </span>
            )}
          </span>
        )}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Anchoring issues · last ${windowDays} days${checkGaps ? ' · gaps ON' : ''}`}
      >
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {data?.generatedAt ? `generatedAt ${new Date(data.generatedAt).toISOString()}` : ''}
            </div>

            <div className="flex items-center gap-2">
              {data && filtered.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={onExportJson}
                    className="rounded-md border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                    title="Export as JSON"
                  >
                    Export JSON
                  </button>
                  <button
                    type="button"
                    onClick={onExportCsv}
                    className="rounded-md border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                    title="Export as CSV"
                  >
                    Export CSV
                  </button>
                  {allTxHashes.length > 0 && (
                    <CopyChip
                      copyKey="bulk:tx"
                      text={allTxHashes.join('\n')}
                      labelDefault="Copy all tx"
                      copyState={copyState}
                      lockedKey={lockedKey}
                      onCopy={onCopy}
                    />
                  )}
                  {allLinks && (
                    <CopyChip
                      copyKey="bulk:links"
                      text={allLinks}
                      labelDefault="Copy all links"
                      copyState={copyState}
                      lockedKey={lockedKey}
                      onCopy={onCopy}
                    />
                  )}
                </>
              )}
              <button
                type="button"
                onClick={onReset}
                className="rounded-md border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                title="Reset filters"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                className="rounded-md border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                title="Reload"
              >
                {loading ? 'Loading…' : 'Reload'}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-md border border-slate-200 dark:border-slate-700 p-2">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-100">
                <input
                  type="checkbox"
                  checked={criticalOnly}
                  onChange={(e) => setCriticalOnly(e.target.checked)}
                />
                Critical only
              </label>

              <label className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-100">
                <input
                  type="checkbox"
                  checked={hideGaps}
                  onChange={(e) => setHideGaps(e.target.checked)}
                />
                Hide gaps
              </label>

              <label className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-100">
                <input
                  type="checkbox"
                  checked={hideAcknowledged}
                  onChange={(e) => setHideAcknowledged(e.target.checked)}
                />
                Hide acknowledged
              </label>

              <label className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-100">
                <span>Group by:</span>
                <select
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value as GroupKey)}
                  className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm"
                >
                  <option value="none">None</option>
                  <option value="type">Type</option>
                  <option value="severity">Severity</option>
                  <option value="anchorId">Anchor</option>
                </select>
              </label>

              <div className="ml-auto text-xs text-slate-500 dark:text-slate-400">
                {data ? (
                  <>
                    Showing <span className="font-semibold">{filtered.length}</span> of{' '}
                    <span className="font-semibold">{counts.total}</span>
                    {uniqueAnchorsCount > 0 && (
                      <> · <span className="font-semibold">{uniqueAnchorsCount}</span> unique anchors</>
                    )}
                  </>
                ) : (
                  ''
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search (type, severity, message, tx, anchor, period)…"
                className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500"
              />
            </div>
          </div>
        </div>

        {err && (
          <div className="mt-3 rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-2 text-sm text-red-900 dark:text-red-200">
            Failed to load issues: {err}
          </div>
        )}

        {!err && loading && !data && (
          <div className="mt-3 text-sm text-slate-600 dark:text-slate-400">Loading…</div>
        )}

        {!err && data && filtered.length === 0 && (
          <div className="mt-3 rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-2 text-sm text-emerald-900 dark:text-emerald-200">
            No issues match current filters.
          </div>
        )}

        {!err && data && filtered.length > 0 && (
          <div className="mt-3 space-y-2">
            {grouped.map(({ key: groupKey, issues }) => {
              const isCollapsed = groupBy !== 'none' && collapsedGroups.has(groupKey);
              const header =
                groupBy !== 'none' ? (
                  <button
                    type="button"
                    onClick={() => toggleGroup(groupKey)}
                    className="flex w-full items-center justify-between rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-2 py-1.5 text-left text-sm font-medium text-slate-800 dark:text-slate-100"
                  >
                    <span>
                      {groupKey === '_' ? 'All' : groupKey} · {issues.length} issue{issues.length !== 1 ? 's' : ''}
                    </span>
                    <span className="text-xs text-slate-500">{isCollapsed ? '▶' : '▼'}</span>
                  </button>
                ) : null;
              return (
                <div key={groupKey} className="space-y-1">
                  {header}
                  {!isCollapsed &&
                    issues.map((i) => (
              <div
                key={i.id}
                className={[
                  'rounded-md border border-slate-200 dark:border-slate-700 p-2',
                  'transition-colors duration-150 ease-out',
                  (() => {
                    const key = `link:${i.id}`;
                    const st = copyState?.key === key ? copyState.status : null;
                    return st ? copyHighlightClass(i.severity, st) : '';
                  })(),
                ].join(' ')}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${pillClass(i.severity)}`}
                    >
                      {i.severity}
                    </span>

                    {(isAcked(i) || ackDisplay(i)) && (
                      <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        Ack: {ackDisplay(i) ?? 'yes'}
                      </span>
                    )}

                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                      {i.type.replace(/_/g, ' ')}
                    </span>

                    {i.txHash &&
                      (() => {
                        const key = `tx:${i.id}`;
                        const st = copyState?.key === key ? copyState.status : null;
                        return (
                          <span
                            className={[
                              'inline-flex items-center gap-2 rounded-md px-1.5 py-0.5 text-xs',
                              'transition-colors duration-150 ease-out',
                              'text-slate-500 dark:text-slate-400',
                              st ? copyHighlightClass(i.severity, st) : '',
                            ].join(' ')}
                          >
                            <span>tx {i.txHash.slice(0, 10)}…</span>
                            <CopyChip
                              copyKey={key}
                              text={i.txHash}
                              labelDefault="Copy"
                              copyState={copyState}
                              lockedKey={lockedKey}
                              onCopy={onCopy}
                            />
                          </span>
                        );
                      })()}

                    {i.anchorId &&
                      (() => {
                        const key = `anchor:${i.id}`;
                        const st = copyState?.key === key ? copyState.status : null;
                        return (
                          <span
                            className={[
                              'inline-flex items-center gap-2 rounded-md px-1.5 py-0.5 text-xs',
                              'transition-colors duration-150 ease-out',
                              'text-slate-500 dark:text-slate-400',
                              st ? copyHighlightClass(i.severity, st) : '',
                            ].join(' ')}
                          >
                            <span>anchor {i.anchorId.slice(0, 8)}…</span>
                            <CopyChip
                              copyKey={key}
                              text={i.anchorId}
                              labelDefault="Copy"
                              copyState={copyState}
                              lockedKey={lockedKey}
                              onCopy={onCopy}
                            />
                          </span>
                        );
                      })()}
                  </div>

                  <div className="flex items-center gap-2">
                    {!isAcked(i) && (
                      <button
                        type="button"
                        onClick={() => onAck(i)}
                        className="rounded-md border border-slate-300 dark:border-slate-600 px-2 py-0.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
                        title="Mark as acknowledged"
                      >
                        Ack
                      </button>
                    )}
                    <CopyChip
                      copyKey={`link:${i.id}`}
                      text={i.actionHref}
                      labelDefault="Copy link"
                      copyState={copyState}
                      lockedKey={lockedKey}
                      onCopy={onCopy}
                    />
                    <a
                      href={i.actionHref}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      title={i.actionHref}
                    >
                      Open →
                    </a>
                  </div>
                </div>

                <div className="mt-1 text-sm text-slate-900 dark:text-slate-100">{i.message}</div>

                {i.suggestedAction && (
                  <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                    Suggested: {i.suggestedAction}
                  </div>
                )}

                {(i.periodStart || i.periodEnd) && (
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {i.periodStart ? new Date(i.periodStart).toISOString() : '?'}
                    {' — '}
                    {i.periodEnd ? new Date(i.periodEnd).toISOString() : '?'}
                  </div>
                )}

                {i.runbookHref && (
                  <a
                    href={i.runbookHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Runbook →
                  </a>
                )}
              </div>
            ))}
                </div>
              );
            })}
          </div>
        )}
      </Modal>
    </div>
  );
}
