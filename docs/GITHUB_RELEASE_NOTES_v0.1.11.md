# Release v0.1.11 — Verify integration for Inspection subsystem

## Overview
v0.1.11 расширяет `/api/system/verify`, добавляя проверку подсистемы Inspection
(с permission-gating и источниковыми метриками), чтобы получать единый verify snapshot.

---

## Key Changes

### /api/system/verify: inspection_verification
- В ответ добавлен блок `inspection_verification`.
- Выполняется только при наличии `INSPECTION.VIEW` или `INSPECTION.MANAGE`.
- При отсутствии прав:
  - `{ skipped: true, reason: "INSPECTION.VIEW not granted" }`
- При успехе:
  - `{ ok: true, message: "Inspection subsystem ok", scope: { card_count: N } }`
- При ошибке источника:
  - `{ ok: false, error: "..." }` (нормализованное сообщение, raw error — в логах)
  - `overallOk` учитывает результат inspection

### Observability
- Добавлен skip reason:
  - `VERIFY_SKIP_REASONS.INSPECTION_VIEW_NOT_GRANTED`
- Source errors:
  - `source="inspection"` в метриках verify aggregator

### Documentation
- `docs/ops/verify-aggregator.md` — описание inspection source
- `docs/ops/RUNBOOK_VERIFY_AGGREGATOR.md` — раздел "Inspection Source Errors"

---

## Tests
- Unit: обновлены тесты `/api/system/verify` для inspection_verification
- E2E smoke: Auditor получает AuthZ + Inspection + Ledger
- `npm run build`: ✅

---

## Release Artifacts
- `dist/regulatory-bundle-v0.1.11.zip`
- SHA-256: **46a7f2217a37fcf99f4f7de25d1806fdb3eb4baf1fe222d9c71d2fb9bc7697fe**
