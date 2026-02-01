# v0.1.2 — RBAC Hardening (Access Control Maturity)

**Цель:** Access control maturity release — кто, куда и на каких основаниях может обращаться; доказуемо и проверяемо.

## Definition of Done

- [x] Ни один endpoint не доступен без permission
- [x] Permissions покрыты unit-тестами
- [x] Нормативный AUTHZ_MODEL.md
- [x] Evidence mapping (ENDPOINT_AUTHZ_EVIDENCE.md)
- [x] Regulatory bundle включает authz-документы
- [x] Route registry + deny-by-default тест
- [ ] Release v0.1.2 (tag, notes)

## Выполнено (базовый контур)

### PR-1: Docs contract
- [x] docs/AUTHZ_MODEL.md
- [x] docs/ENDPOINT_AUTHZ_EVIDENCE.md
- [x] docs/REGULATOR_PACKAGE.md — раздел Access Control
- [x] docs/REGULATORY_BUNDLE_MANIFEST.md — +2 файла

### PR-2/4: AuthZ core + route registry
- [x] lib/authz/permissions.ts
- [x] lib/authz/roles.ts
- [x] lib/authz/routes.ts (route registry)
- [x] lib/authz.ts — рефакторинг (import from permissions)
- [x] __tests__/lib/authz-routes.test.ts (deny-by-default)

### PR-3: Endpoint coverage
- [x] Все endpoints уже используют requirePermission (без изменений)

### PR-5: Bundle integration
- [x] create-regulatory-bundle.sh — AUTHZ_MODEL.md, ENDPOINT_AUTHZ_EVIDENCE.md

## Не входит в v0.1.2

- Изменения модели ИИ
- Автономные действия
- Новые write-эндпоинты
- Изменения схемы ledger
- OPERATOR, CERTIFYING_ENGINEER роли (определены в модели, не засеяны)
