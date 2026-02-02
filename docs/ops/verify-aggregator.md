# Verify Aggregator — Operational Guide

## Overview

`GET /api/system/verify` is the unified verification endpoint (AuthZ + Ledger). This document describes how to observe, interpret, and troubleshoot it in production.

## Metrics

**Endpoint:** `GET /api/metrics`  
**Format:** Prometheus text exposition

### Available Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `verify_aggregator_requests_total{status}` | counter | Total requests by HTTP status (200, 401, 403, 429) |
| `verify_aggregator_rate_limited_total` | counter | Requests that returned 429 |
| `verify_aggregator_ledger_skipped_total{reason}` | counter | Ledger skipped by reason (e.g. `LEDGER.READ not granted`) |
| `verify_aggregator_source_errors_total{source}` | counter | AuthZ or Ledger verification failures |
| `verify_aggregator_request_duration_ms_sum` | counter | Sum of successful request durations (ms) |
| `verify_aggregator_request_duration_ms_count` | counter | Count of successful (200) requests |
| `verify_aggregator_request_duration_ms_bucket{le}` | histogram | Latency distribution (buckets: 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, +Inf ms) |

### Derived Metrics (PromQL examples)

```promql
# Request rate (req/s)
rate(verify_aggregator_requests_total[5m])

# Error rate (excluding 200)
sum(rate(verify_aggregator_requests_total{status!="200"}[5m])) / sum(rate(verify_aggregator_requests_total[5m]))

# p95 latency (ms)
histogram_quantile(0.95, rate(verify_aggregator_request_duration_ms_bucket[5m]))

# p50 latency (ms)
histogram_quantile(0.5, rate(verify_aggregator_request_duration_ms_bucket[5m]))

# Rate limit rate
rate(verify_aggregator_rate_limited_total[5m])

# Ledger skipped share
sum(rate(verify_aggregator_ledger_skipped_total[5m])) / sum(rate(verify_aggregator_requests_total{status="200"}[5m]))
```

## Structured Logs

Logs are emitted as JSON to stdout. Each request produces:

1. **verify_start** — at request start (after auth)
2. **verify_end** — at response (all paths)

### Log Fields

| Field | Description |
|-------|-------------|
| `ts` | ISO timestamp |
| `service` | `verify-aggregator` |
| `request_id` | UUID for correlation |
| `event` | `verify_start` \| `verify_end` |
| `actor` | Redacted (last 4 chars) for privacy |
| `http_status` | HTTP status code |
| `timing_ms` | Total request duration |
| `ledger_included` | Whether Ledger was verified |
| `skip_reason` | Reason if ledger skipped |
| `rate_limited` | true if 429 |
| `error` | Error code (e.g. `RATE_LIMITED`, `FORBIDDEN`, `UPSTREAM_AUTHZ_ERROR`) |

### Correlation

Use `request_id` to correlate logs with API responses. The response body includes `request_id` for all responses (200 success, and `error.request_id` for 401/403/429/503).

### Error Code Filtering

Example: filter logs for 503 upstream errors:

```bash
# Grep JSON logs for UPSTREAM_LEDGER_ERROR
cat logs.json | jq 'select(.error == "UPSTREAM_LEDGER_ERROR")'

# Or in log aggregator query (e.g. CloudWatch Insights, Datadog)
fields @timestamp, request_id, error, timing_ms
| filter error == "UPSTREAM_AUTHZ_ERROR"
| sort @timestamp desc
```

## Scrape Configuration

### Prometheus

```yaml
scrape_configs:
  - job_name: 'papa-app'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: /api/metrics
    scrape_interval: 15s
```

### Access Control

`/api/metrics` has no auth by default. **Protected at ingress** — restrict access at reverse proxy or ingress:

- Nginx: `allow` internal IPs only
- Kubernetes: NetworkPolicy or ingress auth
- Cloud: VPC / private subnet

## Baseline (Reference)

Typical values for a healthy deployment. Use to calibrate alert thresholds:

| Metric | Expected |
|--------|----------|
| p50 latency | < 50 ms |
| p95 latency | < 500 ms |
| Error rate | < 1% |
| 429 rate | Near 0 (rate limit 10/min) |
| Ledger skipped | Depends on role mix (AUDITOR has LEDGER.READ) |

## Troubleshooting

### High 429 rate

- **Cause:** Rate limit (10 req/min per client)
- **Check:** `verify_aggregator_rate_limited_total`
- **Action:** Verify UI is not polling; check for retry storms; consider increasing limit if legitimate

### High ledger skipped

- **Cause:** Users without `LEDGER.READ`
- **Check:** `verify_aggregator_ledger_skipped_total{reason="LEDGER.READ not granted"}`
- **Action:** Expected for read-only roles; if unexpected, verify RBAC role assignments

### High source errors (authz)

- **Cause:** AuthZ verification failure (e.g. duplicate route, invalid policy)
- **Check:** `verify_aggregator_source_errors_total{source="authz"}`
- **Action:** Review route registry, run `scripts/verify-authz.mjs`

### High source errors (ledger)

- **Cause:** Ledger chain break, DB error
- **Check:** `verify_aggregator_source_errors_total{source="ledger"}`
- **Action:** Run `scripts/verify-ledger.mjs`, check DB integrity

### Latency spike

- **Cause:** DB contention, cold start, network
- **Check:** `verify_aggregator_request_duration_ms_bucket`, DB metrics
- **Action:** Check SQLITE_BUSY in logs; consider connection pool tuning

## Runbook

See [RUNBOOK_VERIFY_AGGREGATOR.md](./RUNBOOK_VERIFY_AGGREGATOR.md) for step-by-step procedures.
