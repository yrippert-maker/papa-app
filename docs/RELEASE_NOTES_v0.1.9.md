# Release Notes v0.1.9 — Inspection MVP (read-only)

## Summary

Read-only API для техкарт контроля (Inspection) с RBAC enforcement через `INSPECTION.VIEW`.

## Changes

- **Inspection API**: `GET /api/inspection/cards`, `GET /api/inspection/cards/:id`
- **RBAC**: AUDITOR получает `INSPECTION.VIEW`; enforcement через `requirePermissionWithAlias`
- **Seed**: `REQ-SEED-001`, `CARD-SEED-001`, `CARD-SEED-002`
- **Docs**: `INSPECTION_API.md`, обновлены RBAC.md, ENDPOINT_AUTHZ_EVIDENCE.md
- **Tests**: route_count 17, E2E auditor 200 на inspection/cards

## Runtime fingerprint

- Node.js: см. `package.json` engines
- npm: `npm ci` для воспроизводимой сборки
