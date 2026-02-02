# Release v0.1.9 — Inspection MVP (read-only) + RBAC enforcement

## Overview

v0.1.9 добавляет read-only API для модуля Inspection (техкарты) с фильтрацией и пагинацией,
под `INSPECTION.VIEW`, включая обновления документации и тестов.

---

## Key Changes

### Inspection API (read-only)

- `GET /api/inspection/cards`
  - Query: `kind` (INPUT|OUTPUT), `status`, `limit`, `offset`
  - Response: `{ cards, hasMore }`
- `GET /api/inspection/cards/:id`
  - Response: `card` + `check_results`

### RBAC

- Новый permission: `INSPECTION.VIEW`
- Enforcement через `requirePermissionWithAlias`
- Роли: ADMIN, MANAGER, STOREKEEPER, ENGINEER, AUDITOR
- Seed: AUDITOR получает `INSPECTION.VIEW`

### Seed data

- `tmc_request` — `REQ-SEED-001`
- `inspection_card`:
  - `CARD-SEED-001` (INPUT, DRAFT)
  - `CARD-SEED-002` (OUTPUT, IN_PROGRESS)

### Documentation

- `docs/INSPECTION_API.md` — контракт API
- `docs/RBAC.md` — mapping Inspection endpoints → permissions
- `docs/ENDPOINT_AUTHZ_EVIDENCE.md` — добавлены маршруты Inspection

### API error consistency (400 BAD_REQUEST)

- Все `400` ответы используют единый payload `{ error: { code: "BAD_REQUEST", message, request_id } }`
- Новый helper `badRequest(message, headers)` в `lib/api/error-response.ts`
- Валидация пагинации, JSON, path traversal и т.д. — консистентный формат

### Tests

- Route sync: `route_count 17` (authz-routes-sync / verify-runner / system-verify)
- E2E: AUDITOR → `200` на `/api/inspection/cards`
- Unit: `error-response.test.ts` — badRequest, forbidden, unauthorized
- `npm test`: 129 passed ✅
- `npm run build`: ✅

---

## Compatibility

- Existing RBAC alias rules remain supported.
- No breaking changes to existing endpoints.

---

## Release Artifacts

- `dist/regulatory-bundle-v0.1.9.zip`
- SHA-256: **`c9f37a8d64a93a029bccd4d1920fb7737be1de9e48d4aa7f179b241704b5ff6f`**
