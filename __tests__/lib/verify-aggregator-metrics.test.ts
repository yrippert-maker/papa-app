/**
 * Unit tests for verify-aggregator-metrics.
 */
import { recordVerifyRequest, getPrometheusExposition, resetMetrics } from '@/lib/verify-aggregator-metrics';

describe('verify-aggregator-metrics', () => {
  beforeEach(() => resetMetrics());

  it('records requests by status', () => {
    recordVerifyRequest({ httpStatus: 200, timingMs: 50, ledgerIncluded: true });
    recordVerifyRequest({ httpStatus: 429, timingMs: 0, ledgerIncluded: false, rateLimited: true });
    const out = getPrometheusExposition();
    expect(out).toContain('verify_aggregator_requests_total{status="200"} 1');
    expect(out).toContain('verify_aggregator_requests_total{status="429"} 1');
  });

  it('records rate limited total', () => {
    recordVerifyRequest({ httpStatus: 429, timingMs: 0, ledgerIncluded: false, rateLimited: true });
    recordVerifyRequest({ httpStatus: 429, timingMs: 0, ledgerIncluded: false, rateLimited: true });
    const out = getPrometheusExposition();
    expect(out).toContain('verify_aggregator_rate_limited_total 2');
  });

  it('records ledger skipped by reason', () => {
    recordVerifyRequest({
      httpStatus: 200,
      timingMs: 10,
      ledgerIncluded: false,
      ledgerSkippedReason: 'LEDGER.READ not granted',
    });
    const out = getPrometheusExposition();
    expect(out).toContain('verify_aggregator_ledger_skipped_total{reason="LEDGER.READ not granted"} 1');
  });

  it('records source errors', () => {
    recordVerifyRequest({
      httpStatus: 200,
      timingMs: 5,
      ledgerIncluded: true,
      sourceError: 'ledger',
    });
    const out = getPrometheusExposition();
    expect(out).toContain('verify_aggregator_source_errors_total{source="ledger"} 1');
  });

  it('records latency histogram for 200 only', () => {
    recordVerifyRequest({ httpStatus: 200, timingMs: 50, ledgerIncluded: true });
    recordVerifyRequest({ httpStatus: 403, timingMs: 1, ledgerIncluded: false });
    const out = getPrometheusExposition();
    expect(out).toContain('verify_aggregator_request_duration_ms_count 1');
    expect(out).toContain('verify_aggregator_request_duration_ms_sum 50');
  });

  it('resets metrics', () => {
    recordVerifyRequest({ httpStatus: 200, timingMs: 10, ledgerIncluded: true });
    resetMetrics();
    const out = getPrometheusExposition();
    expect(out).not.toContain('status="200"} 1');
    expect(out).toContain('verify_aggregator_request_duration_ms_count 0');
  });
});
