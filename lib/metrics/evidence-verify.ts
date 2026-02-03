/**
 * Metrics for evidence verification endpoint.
 * Simple in-memory counters; exposed via /api/metrics.
 */

export type EvidenceVerifyMetricType = 
  | 'ok'
  | 'content_invalid'
  | 'key_revoked'
  | 'key_not_found'
  | 'signature_invalid'
  | 'other_error'
  | 'rate_limited'
  | 'unauthorized';

const counters: Record<EvidenceVerifyMetricType, number> = {
  ok: 0,
  content_invalid: 0,
  key_revoked: 0,
  key_not_found: 0,
  signature_invalid: 0,
  other_error: 0,
  rate_limited: 0,
  unauthorized: 0,
};

export function incEvidenceVerifyMetric(type: EvidenceVerifyMetricType): void {
  counters[type]++;
}

export function getEvidenceVerifyMetrics(): Record<EvidenceVerifyMetricType, number> {
  return { ...counters };
}

/**
 * Returns Prometheus-formatted metrics.
 */
export function getEvidenceVerifyMetricsPrometheus(): string {
  const lines: string[] = [
    '# HELP papa_evidence_verify_total Evidence verification results by outcome',
    '# TYPE papa_evidence_verify_total counter',
  ];
  for (const [type, count] of Object.entries(counters)) {
    lines.push(`papa_evidence_verify_total{result="${type}"} ${count}`);
  }
  return lines.join('\n');
}
