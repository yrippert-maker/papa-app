# v0.1.8 — RBAC refinement

## Цель

1. Развести VIEW vs MANAGE для TMC Requests (и подготовить Inspection)
2. Без регресса существующих read-сценариев (auditor/reader роли)
3. Семантика ошибок: 403 + error.code=FORBIDDEN

## Permission taxonomy

### TMC Requests

- **TMC.REQUEST.VIEW** — чтение заявок, списки, детали
- **TMC.REQUEST.MANAGE** — создание/редактирование/удаление заявок

### TMC Items/Lots (legacy)

- **TMC.VIEW** — просмотр реестра и лотов (legacy, alias для TMC.REQUEST.VIEW на read)
- **TMC.MANAGE** — создание/обновление ТМЦ

### Inspection (заготовка)

- **INSPECTION.VIEW**
- **INSPECTION.MANAGE**

## Alias strategy

- TMC.REQUEST.VIEW == TMC.REQUEST.VIEW OR TMC.VIEW (legacy)
- TMC.REQUEST.MANAGE == TMC.REQUEST.MANAGE OR TMC.MANAGE (legacy)
- MANAGE имплицирует VIEW для read endpoints

## PR-план

### PR-1: Permission model + alias layer + docs ✅

### PR-2: Backend enforcement ✅

### PR-3: Tests ✅

### PR-4: Inspection scaffolding ✅

- [x] INSPECTION.VIEW, INSPECTION.MANAGE в permissions.ts
- [x] Alias layer в rbac-aliases.ts
- [x] docs/RBAC.md, AUTHZ_MODEL.md
