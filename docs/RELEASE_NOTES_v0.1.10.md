# Release Notes v0.1.10 — Inspection MANAGE (transitions + audit trail)

## Summary

Управляемые transitions для техкарт контроля под `INSPECTION.MANAGE` с audit trail в ledger.

## Changes

- **API**: `POST /api/inspection/cards/:id/transition` — изменение статуса карты
- **State machine**: DRAFT → IN_PROGRESS → COMPLETED; DRAFT/IN_PROGRESS → CANCELLED; COMPLETED — immutable
- **RBAC**: только `INSPECTION.MANAGE` (MANAGER, STOREKEEPER, ADMIN)
- **Ledger**: `INSPECTION_CARD_TRANSITION` при каждом успешном переходе
- **Migration**: `transitioned_by`, `transitioned_at` (004_inspection_transitions)
- **Docs**: `INSPECTION_TRANSITIONS.md`, обновлены INSPECTION_API, RBAC, ENDPOINT_AUTHZ_EVIDENCE
- **Tests**: route_count 18, E2E auditor 403 / admin 200 на transition

## Runtime fingerprint

- Node.js: см. `package.json` engines
- npm: `npm ci` для воспроизводимой сборки
