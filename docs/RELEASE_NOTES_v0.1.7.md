# Release Notes v0.1.7

**Release Date:** 2026-02-02  
**Tag:** `v0.1.7`  
**Status:** Production-ready

---

## Summary

v0.1.7 delivers **operational polish** for the Verify Aggregator (`GET /api/system/verify`): structured logs, Prometheus metrics, standardized error payloads, and a runbook. This maximizes the value of v0.1.6 by making the endpoint observable and predictable in production.

---

## 1. Observability Baseline

### 1.1 Structured Logs

- **Events:** `verify_start`, `verify_end` (JSON to stdout)
- **Fields:** `request_id`, `actor` (redacted), `http_status`, `timing_ms`, `ledger_included`, `skip_reason`, `rate_limited`, `error` (error code)
- **Correlation:** `request_id` in logs and API responses

### 1.2 Metrics

- **Endpoint:** `GET /api/metrics` — Prometheus text exposition format
- **Metrics:**
  - `verify_aggregator_requests_total{status}`
  - `verify_aggregator_rate_limited_total`
  - `verify_aggregator_ledger_skipped_total{reason}`
  - `verify_aggregator_source_errors_total{source}`
  - `verify_aggregator_request_duration_ms_*` (histogram, sum, count)
- **Access:** No auth by default; **protected at ingress** (restrict at reverse proxy)

### 1.3 Documentation

- `docs/ops/verify-aggregator.md` — metrics, logs, PromQL, scrape config, troubleshooting
- `docs/ops/RUNBOOK_VERIFY_AGGREGATOR.md` — runbook with recommended Prometheus alerts

---

## 2. Error Payload Standardization

### 2.1 Unified Format

All non-2xx responses now use:

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests",
    "request_id": "835942d3-1c68-4fe9-aeaa-d46fdfc9c8be"
  }
}
```

### 2.2 Error Codes

| HTTP | Code | Meaning |
|------|------|---------|
| 401 | `UNAUTHORIZED` | Not authenticated |
| 403 | `FORBIDDEN` | No WORKSPACE.READ permission |
| 429 | `RATE_LIMITED` | Rate limit exceeded |
| 503 | `UPSTREAM_AUTHZ_ERROR` | AuthZ verification failed internally |
| 503 | `UPSTREAM_LEDGER_ERROR` | Ledger verification failed internally |

### 2.3 Semantics

- **403 FORBIDDEN** — no `WORKSPACE.READ`
- **200 + skipped** — no `LEDGER.READ` (not an error)
- **503** — internal upstream failure (AuthZ or Ledger)

---

## 3. Breaking Changes

**None.** All changes are additive or internal. Response shape for 200 success unchanged (except `request_id` added in v0.1.6).

---

## 4. Migration Notes

### From v0.1.6 → v0.1.7

- **Error responses:** If clients parse error bodies, update to `error.code` and `error.request_id`
- **Metrics:** Add Prometheus scrape for `/api/metrics`; restrict access at ingress
- **Logs:** JSON format; configure log aggregator to parse

---

## 5. Verification Steps

1. `npm test` — 18 suites, 106 tests
2. `npm run build` — success
3. `npm run e2e` — all scenarios pass
4. `GET /api/metrics` — returns Prometheus format

---

## 6. Release Artifact

**Bundle:** `dist/regulatory-bundle-v0.1.7.zip`  
**SHA-256:** (to be added after bundle creation)
