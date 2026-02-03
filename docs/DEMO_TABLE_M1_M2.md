# Демо-таблица M1/M2 — Ожидаемый код / Факт

**Milestone M1:** Policy + 401/403 + защита API  
**Milestone M2:** Логин из БД, не из env

---

## M1: Policy layer и RBAC на API

| Критерий | Ожидаемый код | Факт |
|----------|---------------|------|
| Policy слой | `lib/authz.ts` с `can()`, `requirePermission()`, `getPermissionsForRole()` | ✅ Реализовано |
| Матрица прав | `rbac_role_permission` → WORKSPACE.READ, FILES.*, LEDGER.*, TMC.* | ✅ В миграциях + `PERMISSIONS` в authz |
| Все API защищены | `requirePermission(session, PERM)` в каждом route | ✅ workspace, files, ledger, tmc — все |
| 401 vs 403 | 401 — нет сессии; 403 — нет permission | ✅ `requirePermission()` возвращает 401/403 |
| Роль в сессии | JWT callback → token.role; session callback → user.role | ✅ auth-options.ts |
| AUDITOR (read-only) | Роль без FILES.UPLOAD, LEDGER.APPEND, TMC.MANAGE | ✅ Только WORKSPACE.READ, FILES.LIST, LEDGER.READ |
| Нет ручных if | Endpoint'ы вызывают `requirePermission`, не проверяют роль вручную | ✅ |

---

## M2: Credentials из users table

| Критерий | Ожидаемый код | Факт |
|----------|---------------|------|
| authorize() из БД | SELECT users по email, bcrypt.compare(password, hash) | ✅ lib/auth-options.ts |
| AUTH_USER/AUTH_PASSWORD | Не используются в authorize | ✅ Удалены |
| Роль из БД | authorize возвращает role: row.role_code | ✅ |
| Seed первого admin | `npm run seed:admin` | ✅ scripts/seed-admin.mjs |
| bcrypt cost | 10–12 | ✅ cost 12 |
| Fail-fast default admin | Production + admin@local/admin → 500 на status | ✅ lib/security-checks.ts |

---

## Тесты

| Тест | Статус |
|------|--------|
| Unit: getPermissionsForRole('AUDITOR') | ✅ __tests__/lib/authz.test.ts |
| Unit: requirePermission 401 (null session) | ✅ |
| Unit: requirePermission 403 (AUDITOR на FILES.UPLOAD) | ✅ |
| Unit: requirePermission null (ADMIN на FILES.UPLOAD) | ✅ |
| E2E: unauthenticated → 401/307 | ✅ |
| E2E: admin login → 200 workspace/status | ✅ |
| E2E: auditor login → 200 workspace/status | ✅ |
| E2E: auditor 403 на write (Node fetch) | ✅ Cookie jar — стабильно (tmc/items, ledger/append) |

---

## Итог

**M1:** Закрыт  
**M2:** Закрыт  
**E2E auditor 403:** Cookie jar — стабильно в CI  
**P1-минимум (US-1–US-4):** Готов к US-5/US-7/US-8
