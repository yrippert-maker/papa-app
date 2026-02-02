# Release v0.1.10 — Inspection MANAGE (transitions + audit trail)

## Overview
v0.1.10 добавляет управляемые transitions для техкарт контроля (Inspection) под `INSPECTION.MANAGE`
и фиксирует audit trail в ledger для каждого успешного перехода.

---

## Key Changes

### Inspection transitions (state machine)
- State machine для `inspection_card.status`:
  - `DRAFT → IN_PROGRESS → COMPLETED`
  - `DRAFT → CANCELLED`
  - `IN_PROGRESS → CANCELLED`
- Terminal/immutability:
  - `COMPLETED` — immutable (переходы запрещены)
  - `CANCELLED` — terminal

### API
- `POST /api/inspection/cards/:id/transition`
  - Body: `{ "status": "IN_PROGRESS" | "COMPLETED" | "CANCELLED" }`
  - Permission: `INSPECTION.MANAGE`
  - `400 BAD_REQUEST` для невалидных переходов
  - `403 FORBIDDEN` для ролей без `INSPECTION.MANAGE`

### Audit trail (ledger)
- Новый тип события: `INSPECTION_CARD_TRANSITION`
- При каждом успешном transition создаётся запись в `ledger_events` с деталями перехода

### Database
- Миграция: добавлены `transitioned_by`, `transitioned_at` (idempotent)

### Documentation / Evidence
- `docs/INSPECTION_TRANSITIONS.md` — правила transitions
- Обновлены:
  - `docs/INSPECTION_API.md`
  - `docs/RBAC.md`
  - `docs/ENDPOINT_AUTHZ_EVIDENCE.md`

---

## Tests
- Unit: inspection transitions / audit / ledger schema
- Integration: transition endpoint (200/400/403)
- E2E: Auditor → 403, Admin → 200 (DRAFT→IN_PROGRESS)
- Total: **150 tests passed**
- `npm run build`: ✅
- `npm run e2e`: ✅

---

## Release Artifacts
- `dist/regulatory-bundle-v0.1.10.zip`
- SHA-256: **<ADD_SHA256_HERE>**
