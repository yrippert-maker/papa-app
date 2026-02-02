# Release v0.1.7 — Operational polish for Verify Aggregator

## Highlights

### Observability

- **Structured logs:** JSON `verify_start`/`verify_end` with `request_id`, `actor`, `http_status`, `timing_ms`
- **Metrics:** `GET /api/metrics` — Prometheus exposition format
- **Runbook:** `docs/ops/RUNBOOK_VERIFY_AGGREGATOR.md` with troubleshooting and recommended alerts
- **Note:** `/api/metrics` — protected at ingress (no auth by default)

### Error Standardization

- **Unified payload:** All non-2xx responses use `error: { code, message, request_id }`
- **Error codes:** `UNAUTHORIZED`, `FORBIDDEN`, `RATE_LIMITED`, `UPSTREAM_AUTHZ_ERROR`, `UPSTREAM_LEDGER_ERROR`
- **Semantics:** 403 = no WORKSPACE.READ; 200 + skipped = no LEDGER.READ; 503 = upstream failure

### Documentation

- `docs/ops/verify-aggregator.md` — metrics, logs, PromQL, scrape config
- `docs/verify-aggregator.md` — error codes table

## Breaking Changes

None. Error response shape changed (additive: `error.code`, `error.request_id`).

## Verification

```bash
npm test         # ✅ 106 tests
npm run build    # ✅
npm run e2e      # ✅
```

---

**Full release notes:** [RELEASE_NOTES_v0.1.7.md](docs/RELEASE_NOTES_v0.1.7.md)
