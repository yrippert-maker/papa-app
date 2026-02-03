# v0.1.7 — External Changelog (short)

- **Observability:** Structured logs (`verify_start`/`verify_end`) and Prometheus metrics for `/api/system/verify`
- **Metrics endpoint:** `GET /api/metrics` — Prometheus exposition (restrict at ingress)
- **Error standardization:** All non-2xx responses use `error: { code, message, request_id }` with stable codes
- **Runbook:** `docs/ops/RUNBOOK_VERIFY_AGGREGATOR.md` — troubleshooting, PromQL, recommended alerts
- **Compatibility:** Success response unchanged; UI no changes required
