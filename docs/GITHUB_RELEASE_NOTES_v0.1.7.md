# Release v0.1.7 — Verify aggregator observability & error standardization

## Overview

v0.1.7 фокусируется на эксплуатационной зрелости `/api/system/verify`:
наблюдаемость, корреляция запросов, стандартизированные ошибки и готовность к дежурству
без изменения успешного контракта ответа.

---

## Key Changes

### Observability baseline

- Structured logs для Verify aggregator:
  - события: `verify_start`, `verify_end`
  - поля: `request_id`, `actor`, `http_status`, `timing_ms`,
    `ledger_included`, `skip_reason`, `rate_limited`, `error`
- Метрики (Prometheus):
  - `verify_aggregator_requests_total{status}`
  - `verify_aggregator_rate_limited_total`
  - `verify_aggregator_ledger_skipped_total{reason}`
  - `verify_aggregator_source_errors_total{source}`
  - `verify_aggregator_request_duration_ms_*` (histogram)
- Endpoint `/api/metrics`:
  - Prometheus text exposition
  - без auth (доступ ограничивается на уровне proxy / ingress)

### Error payload standardization

- Все non-2xx ответы `/api/system/verify` имеют единый формат:

  ```json
  {
    "error": {
      "code": "RATE_LIMITED",
      "message": "Too many requests",
      "request_id": "..."
    }
  }
  ```

- Введены стабильные error codes:
  - `UNAUTHORIZED`
  - `FORBIDDEN`
  - `RATE_LIMITED`
  - `UPSTREAM_AUTHZ_ERROR`
  - `UPSTREAM_LEDGER_ERROR`
  - `INTERNAL_ERROR`
- Чётко разделены случаи:
  - `403 FORBIDDEN` — нет `WORKSPACE.READ`
  - `200 + ledger_verification.skipped` — нет `LEDGER.READ` (не ошибка)
  - `503 UPSTREAM_*_ERROR` — внутренние ошибки AuthZ / Ledger

### Operations & Runbook

- Добавлен runbook:
  - `docs/ops/RUNBOOK_VERIFY_AGGREGATOR.md`
  - latency / error-rate / 429 scenarios
  - примеры PromQL и troubleshooting шаги
- Документация по метрикам и логам:
  - `docs/ops/verify-aggregator.md`

---

## Compatibility

- Успешный ответ `/api/system/verify` **не изменён**
  (добавлено только поле `request_id`, обратная совместимость сохранена).
- UI изменений не требует.

---

## Tests

- Unit + integration tests для error payload и permission branching
- Всего: **18 test suites, 106 tests**
- `npm test`, `npm run build`, `npm run e2e` — ✅

---

## Security Notes

- `/api/metrics` должен быть ограничен на уровне ingress / proxy
  (не предназначен для публичного доступа).

---

## Upgrade Notes

- Рекомендуется обновить лог-парсеры / алерты для использования `error.code`
  вместо анализа текстов ошибок.
- Runbook содержит примерные пороги — откалибровать по production baseline.

---

## Release Artifacts

- `dist/regulatory-bundle-v0.1.7.zip`
- SHA-256: `7c86f4b91b445aaea2a52feb0cf2116d3b9d8b2c692d1c581bebcdc9d66cbe50`
