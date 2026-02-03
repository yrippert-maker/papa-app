# Release Notes v0.1.12 — Inspection check_results write-path + ledger audit

## Summary

Write-path для результатов проверок (check_results) под INSPECTION.MANAGE с value/unit, idempotency и ledger audit.

## Changes

- **API**: `POST /api/inspection/cards/:id/check-results` — запись/обновление результатов
- **Body**: `check_code`, `result`, `value?`, `unit?`, `comment?`
- **Immutability**: только DRAFT | IN_PROGRESS
- **Ledger**: `INSPECTION_CHECK_RECORDED` при реальном изменении (без дублей)
- **Migration**: 005 — value, unit в inspection_check_result
- **Docs**: INSPECTION_API.md

## Runtime fingerprint

- Node.js: см. `package.json` engines
- npm: `npm ci` для воспроизводимой сборки
