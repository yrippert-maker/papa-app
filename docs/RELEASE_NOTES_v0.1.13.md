# Release Notes v0.1.13 — Inspection UI hardening, report UX, audit pagination

## Summary

Inspection-модуль: permissions hardening в UI, report summary на /inspection, audit pagination.

## Changes

- **Report API**: `GET /api/inspection/report` — агрегаты (total_cards, by_status, completion_rate_pct, fail_rate_pct, breakdown_by_check_code)
- **Audit API**: `GET /api/inspection/cards/:id/audit` — события INSPECTION_CARD_TRANSITION, INSPECTION_CHECK_RECORDED; pagination: limit (default 100, max 500), offset; response: events, total, hasMore, limit, offset
- **Card detail API**: `template_hints` в ответе GET /api/inspection/cards/:id
- **UI**: страницы /inspection, /inspection/[id], /inspection/[id]/audit
- **UI permissions**: проверка INSPECTION.VIEW | INSPECTION.MANAGE; экран "Доступ запрещён" при отсутствии прав; обработка 403
- **Report UX**: summary cards на /inspection (всего карт, завершено %, fail %, кол-во FAIL)
- **Audit UX**: загрузка по 50, "N из total", "Загрузить ещё"
- **UX**: индикация сохранения, подсказки шаблонов, блокировка редактирования COMPLETED/CANCELLED, transitions
- **Nav**: пункт «Техкарты» в сайдбаре (INSPECTION.VIEW)
- **Docs**: INSPECTION_API.md
- **Tests**: 169 passed, E2E smoke ✅

## Runtime fingerprint

- Node.js: см. `package.json` engines
- npm: `npm ci` для воспроизводимой сборки
