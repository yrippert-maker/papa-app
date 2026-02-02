/**
 * Unit tests for metrics modules.
 */
describe('evidence-verify metrics', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('incEvidenceVerifyMetric increments counters', () => {
    const { incEvidenceVerifyMetric, getEvidenceVerifyMetrics } = require('@/lib/metrics/evidence-verify');
    
    const before = getEvidenceVerifyMetrics();
    expect(before.ok).toBe(0);
    
    incEvidenceVerifyMetric('ok');
    incEvidenceVerifyMetric('ok');
    incEvidenceVerifyMetric('key_revoked');
    
    const after = getEvidenceVerifyMetrics();
    expect(after.ok).toBe(2);
    expect(after.key_revoked).toBe(1);
  });

  it('getEvidenceVerifyMetricsPrometheus returns valid format', () => {
    const { incEvidenceVerifyMetric, getEvidenceVerifyMetricsPrometheus } = require('@/lib/metrics/evidence-verify');
    
    incEvidenceVerifyMetric('signature_invalid');
    
    const output = getEvidenceVerifyMetricsPrometheus();
    expect(output).toContain('# HELP papa_evidence_verify_total');
    expect(output).toContain('# TYPE papa_evidence_verify_total counter');
    expect(output).toContain('papa_evidence_verify_total{result="signature_invalid"}');
  });
});

describe('dead-letter metrics', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('incDeadLetterEvent increments counter', () => {
    const { incDeadLetterEvent, getDeadLetterMetrics } = require('@/lib/metrics/dead-letter');
    
    const before = getDeadLetterMetrics();
    expect(before.events_total).toBe(0);
    
    incDeadLetterEvent();
    incDeadLetterEvent();
    
    const after = getDeadLetterMetrics();
    expect(after.events_total).toBe(2);
  });

  it('incReplayMetric increments by mode and result', () => {
    const { incReplayMetric, getDeadLetterMetrics } = require('@/lib/metrics/dead-letter');
    
    incReplayMetric('dry-run', 'ok');
    incReplayMetric('dry-run', 'failed');
    incReplayMetric('live', 'ok');
    incReplayMetric('live', 'ok');
    incReplayMetric('live', 'failed');
    
    const metrics = getDeadLetterMetrics();
    expect(metrics.replay_dry_run_ok).toBe(1);
    expect(metrics.replay_dry_run_failed).toBe(1);
    expect(metrics.replay_live_ok).toBe(2);
    expect(metrics.replay_live_failed).toBe(1);
  });

  it('getDeadLetterMetricsPrometheus returns valid format', () => {
    const { incDeadLetterEvent, getDeadLetterMetricsPrometheus } = require('@/lib/metrics/dead-letter');
    
    incDeadLetterEvent();
    
    const output = getDeadLetterMetricsPrometheus();
    expect(output).toContain('# HELP papa_ledger_dead_letter_events_total');
    expect(output).toContain('# TYPE papa_ledger_dead_letter_events_total counter');
    expect(output).toContain('papa_ledger_dead_letter_events_total');
    expect(output).toContain('papa_ledger_dead_letter_replay_total');
  });
});
