/**
 * Metrics for ledger dead-letter operations.
 * Exposed via /api/metrics.
 */

let eventsTotal = 0;
let replayDryRunOk = 0;
let replayDryRunFailed = 0;
let replayLiveOk = 0;
let replayLiveFailed = 0;

export function incDeadLetterEvent(): void {
  eventsTotal++;
}

export function incReplayMetric(mode: 'dry-run' | 'live', result: 'ok' | 'failed'): void {
  if (mode === 'dry-run') {
    if (result === 'ok') replayDryRunOk++;
    else replayDryRunFailed++;
  } else {
    if (result === 'ok') replayLiveOk++;
    else replayLiveFailed++;
  }
}

export function getDeadLetterMetrics(): {
  events_total: number;
  replay_dry_run_ok: number;
  replay_dry_run_failed: number;
  replay_live_ok: number;
  replay_live_failed: number;
} {
  return {
    events_total: eventsTotal,
    replay_dry_run_ok: replayDryRunOk,
    replay_dry_run_failed: replayDryRunFailed,
    replay_live_ok: replayLiveOk,
    replay_live_failed: replayLiveFailed,
  };
}

/**
 * Returns Prometheus-formatted metrics.
 */
export function getDeadLetterMetricsPrometheus(): string {
  const lines: string[] = [
    '# HELP papa_ledger_dead_letter_events_total Total dead-letter events recorded',
    '# TYPE papa_ledger_dead_letter_events_total counter',
    `papa_ledger_dead_letter_events_total ${eventsTotal}`,
    '',
    '# HELP papa_ledger_dead_letter_replay_total Replay operations by mode and result',
    '# TYPE papa_ledger_dead_letter_replay_total counter',
    `papa_ledger_dead_letter_replay_total{mode="dry-run",result="ok"} ${replayDryRunOk}`,
    `papa_ledger_dead_letter_replay_total{mode="dry-run",result="failed"} ${replayDryRunFailed}`,
    `papa_ledger_dead_letter_replay_total{mode="live",result="ok"} ${replayLiveOk}`,
    `papa_ledger_dead_letter_replay_total{mode="live",result="failed"} ${replayLiveFailed}`,
  ];
  return lines.join('\n');
}
