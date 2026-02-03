/**
 * In-memory metrics for /api/system/verify.
 * Exported in Prometheus text exposition format.
 * No external dependencies.
 */
const BUCKETS_MS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

type Counters = Record<string, number>;
type HistogramBuckets = Record<string, number>;

let requestsTotal: Counters = {};
let rateLimitedTotal = 0;
let ledgerSkippedTotal: Counters = {};
let sourceErrorsTotal: Counters = {};
let latencyBuckets: HistogramBuckets = {};
let latencySumMs = 0;
let latencyCount = 0;

function incCounter(map: Counters, key: string, delta = 1): void {
  map[key] = (map[key] ?? 0) + delta;
}

function observeLatency(ms: number): void {
  latencySumMs += ms;
  latencyCount += 1;
  for (const le of BUCKETS_MS) {
    if (ms <= le) {
      const key = String(le);
      latencyBuckets[key] = (latencyBuckets[key] ?? 0) + 1;
    }
  }
  const infKey = '+Inf';
  latencyBuckets[infKey] = (latencyBuckets[infKey] ?? 0) + 1;
}

export function recordVerifyRequest(params: {
  httpStatus: number;
  timingMs: number;
  ledgerIncluded: boolean;
  ledgerSkippedReason?: string;
  rateLimited?: boolean;
  sourceError?: 'authz' | 'inspection' | 'ledger';
}): void {
  const { httpStatus, timingMs, ledgerIncluded, ledgerSkippedReason, rateLimited, sourceError } = params;

  const statusKey = String(httpStatus);
  incCounter(requestsTotal, statusKey);

  if (rateLimited) {
    rateLimitedTotal += 1;
  }

  if (ledgerSkippedReason) {
    incCounter(ledgerSkippedTotal, ledgerSkippedReason);
  }

  if (sourceError) {
    incCounter(sourceErrorsTotal, sourceError);
  }

  if (httpStatus === 200) {
    observeLatency(timingMs);
  }
}

export function getPrometheusExposition(): string {
  const lines: string[] = [];
  lines.push('# HELP verify_aggregator_requests_total Total verify aggregator requests by HTTP status');
  lines.push('# TYPE verify_aggregator_requests_total counter');
  for (const [status, count] of Object.entries(requestsTotal).sort()) {
    lines.push(`verify_aggregator_requests_total{status="${status}"} ${count}`);
  }

  lines.push('# HELP verify_aggregator_rate_limited_total Total rate-limited (429) responses');
  lines.push('# TYPE verify_aggregator_rate_limited_total counter');
  lines.push(`verify_aggregator_rate_limited_total ${rateLimitedTotal}`);

  lines.push('# HELP verify_aggregator_ledger_skipped_total Ledger verification skipped by reason');
  lines.push('# TYPE verify_aggregator_ledger_skipped_total counter');
  for (const [reason, count] of Object.entries(ledgerSkippedTotal).sort()) {
    const safe = reason.replace(/"/g, '\\"');
    lines.push(`verify_aggregator_ledger_skipped_total{reason="${safe}"} ${count}`);
  }

  lines.push('# HELP verify_aggregator_source_errors_total Source verification errors (authz/ledger)');
  lines.push('# TYPE verify_aggregator_source_errors_total counter');
  for (const [source, count] of Object.entries(sourceErrorsTotal).sort()) {
    lines.push(`verify_aggregator_source_errors_total{source="${source}"} ${count}`);
  }

  lines.push('# HELP verify_aggregator_request_duration_ms_sum Sum of request durations in ms');
  lines.push('# TYPE verify_aggregator_request_duration_ms_sum counter');
  lines.push(`verify_aggregator_request_duration_ms_sum ${latencySumMs}`);

  lines.push('# HELP verify_aggregator_request_duration_ms_count Count of successful requests');
  lines.push('# TYPE verify_aggregator_request_duration_ms_count counter');
  lines.push(`verify_aggregator_request_duration_ms_count ${latencyCount}`);

  lines.push('# HELP verify_aggregator_request_duration_ms_bucket Request duration histogram buckets (ms)');
  lines.push('# TYPE verify_aggregator_request_duration_ms_bucket histogram');
  for (const le of [...BUCKETS_MS.sort((a, b) => a - b), Infinity]) {
    const leStr = le === Infinity ? '+Inf' : String(le);
    const count = latencyBuckets[leStr] ?? 0;
    lines.push(`verify_aggregator_request_duration_ms_bucket{le="${leStr}"} ${count}`);
  }

  return lines.join('\n') + '\n';
}

/** Reset all metrics (for tests). */
export function resetMetrics(): void {
  requestsTotal = {};
  rateLimitedTotal = 0;
  ledgerSkippedTotal = {};
  sourceErrorsTotal = {};
  latencyBuckets = {};
  latencySumMs = 0;
  latencyCount = 0;
}
