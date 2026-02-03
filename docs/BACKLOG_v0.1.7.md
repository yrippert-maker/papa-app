# v0.1.7 — Operational polish для `/api/system/verify`

## Цель

Сделать endpoint наблюдаемым и предсказуемым в проде: метрики, structured logs, стандартизированные ошибки, runbook.

## PR-план

### PR-1: Observability baseline ✅

- [x] Structured logs (request_id, actor, http_status, timing_ms, ledger_included, skip_reason)
- [x] In-memory metrics (requests_total, latency histogram, ledger_skipped_total, rate_limited_total, source_errors_total)
- [x] `/api/metrics` endpoint (Prometheus exposition format, no auth)
- [x] docs/ops/verify-aggregator.md (metrics, logs, PromQL, scrape config)
- [x] docs/ops/RUNBOOK_VERIFY_AGGREGATOR.md (troubleshooting + recommended alerts)

### PR-2: Hardening поведения при деградациях ✅

- [x] Стандартизировать error payload: `error.code`, `error.message`, `error.request_id`
- [x] Разделить `not granted` (200 + skipped) vs `internal error` (503 + error code)
- [x] `verify_aggregator_source_errors_total{source}` (уже в PR-1, теперь используется)
- [x] Error codes: UNAUTHORIZED, FORBIDDEN, RATE_LIMITED, UPSTREAM_AUTHZ_ERROR, UPSTREAM_LEDGER_ERROR
- [x] Логи: добавлено поле `error` (код ошибки)
- [x] Docs: verify-aggregator.md, ops/verify-aggregator.md обновлены

### PR-3: Alerting hooks + runbook

- [ ] Рекомендованные алерты (p95 latency, error rate, 429 spike)
- [ ] Runbook: skipped, 429, ledger errors, authz errors

## DoD v0.1.7 ✅

- [x] Метрики: RPS/коды, latency p50/p95, skipped по reason, rate-limit
- [x] Логи: request_id для корреляции
- [x] Error payload стандартизирован
- [x] Runbook + рекомендованные алерты (latency, error-rate, 429)
- [x] npm test / build / e2e зелёные

## Стек мониторинга

Текущий: **console + JSON logs**. Метрики — in-memory, экспорт в Prometheus text format (без зависимостей). Готово к интеграции с Prometheus/Grafana/Datadog/CloudWatch.
