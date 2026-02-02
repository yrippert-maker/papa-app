# Release v0.1.15 — Evidence export for Inspection cards

## Overview
v0.1.15 добавляет evidence export для техкарт контроля (Inspection):
self-contained JSON snapshot с результатами проверок, audit events из ledger
и детерминированным `export_hash` (SHA-256 canonical JSON) для проверки целостности.

---

## Key Changes

### Evidence export API
- `GET /api/inspection/cards/:id/evidence`
  - Permission: `INSPECTION.VIEW`
  - Response JSON включает:
    - `schema_version`, `exported_at`, `inspection_card_id`
    - `card` — snapshot карты (включая `request_no`, `request_title`)
    - `check_results` — результаты проверок
    - `audit_events` — события ledger (включая `block_hash`, `prev_hash`, `actor_id`)
    - `export_hash` — SHA-256 canonical JSON для проверки целостности

### Evidence builder
- `lib/inspection-evidence.ts`
  - `buildEvidenceExport()`
  - `canonicalizeForHash()` — детерминированный canonical JSON
  - `computeExportHash()` — SHA-256 hash

### Error format
- Standardized `404 NOT_FOUND` error payload (with `request_id`) across API
- 404/500 используют стандартизированный формат `{ error: { code, message, request_id } }`
- Добавлен `NOT_FOUND` в `VerifyErrorCodes`, хелпер `notFound()` в error-response

### AuthZ / route registry
- Маршрут добавлен в `lib/authz/routes.ts` и `routes-export.mjs`
- Route count: 22

### Documentation
- `docs/INSPECTION_API.md` — описание evidence endpoint
- `docs/ENDPOINT_AUTHZ_EVIDENCE.md` — добавлены audit и evidence

---

## Tests
- API + library tests (включая детерминированность `export_hash`, порядок массивов)
- E2E smoke: Auditor → `200` на `/api/inspection/cards/:id/evidence`
- Total: **188 tests passed**
- Build: ✅

---

## Release Artifacts
- `dist/regulatory-bundle-v0.1.15.zip`
- SHA-256: **<ADD_SHA256_HERE>**
