# Release v0.1.13 — Inspection UI hardening, report UX, and audit pagination

## Overview
v0.1.13 завершает пользовательский контур Inspection: усиливает проверки прав в UI,
добавляет summary-report на странице списка, и делает audit-журнал масштабируемым
через pagination на API и "load more" в UI.

---

## Key Changes

### UI: permissions hardening
- `/inspection`, `/inspection/[id]`, `/inspection/[id]/audit` проверяют `INSPECTION.VIEW | INSPECTION.MANAGE`.
- При отсутствии прав:
  - экран "Доступ запрещён" + кнопка "На главную"
  - обработка `403` от API на страницах detail/audit

### UI: report UX on /inspection
- Параллельный запрос `/api/inspection/report` вместе с `/api/inspection/cards`.
- Summary блок из 4 карточек:
  - Всего карт
  - Завершено (%)
  - Не пройдено (FAIL %)
  - Количество результатов FAIL

### API/UI: audit pagination
- `GET /api/inspection/cards/:id/audit`
  - Query: `limit` (default 100, max 500), `offset` (default 0)
  - Response: `{ events, total, hasMore, limit, offset }`
- UI:
  - загрузка по 50 событий
  - отображение "N из total"
  - "Загрузить ещё" при `hasMore`

---

## Tests
- Total: **169 tests passed**
- Build: ✅

---

## Release Artifacts
- `dist/regulatory-bundle-v0.1.13.zip`
- SHA-256: **95ce039ace5ae5c6f7c67632db2e302c3070ef732c0245f2021e9467ad9a88af**
