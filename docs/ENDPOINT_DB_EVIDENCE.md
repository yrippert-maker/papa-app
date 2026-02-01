# Endpoint → DB Mode → Responsibility → Evidence

**Версия:** v0.1.1  
**Назначение:** регуляторный артефакт — доказательство разделения readonly/readwrite и привязка к тестам.

---

## Таблица

| Endpoint | Method | DB Mode | Permission | Роль (мин.) | Evidence (тест) |
|----------|--------|---------|------------|-------------|-----------------|
| `/api/workspace/status` | GET | readonly | WORKSPACE.READ | AUDITOR | E2E: auditor 200 |
| `/api/workspace/init` | POST | readwrite | WORKSPACE.READ | AUDITOR | E2E: init перед status |
| `/api/admin/users` | GET | readonly | ADMIN.MANAGE_USERS | ADMIN | E2E: admin 200, pagination |
| `/api/admin/users` | POST | readwrite | ADMIN.MANAGE_USERS | ADMIN | E2E: create user 200 |
| `/api/admin/users/[id]` | PATCH | readwrite | ADMIN.MANAGE_USERS | ADMIN | E2E: (role/reset) |
| `/api/tmc/items` | GET | readonly | TMC.MANAGE | STOREKEEPER | E2E: auditor 403 |
| `/api/tmc/lots` | GET | readonly | TMC.MANAGE | STOREKEEPER | E2E: auditor 403 |
| `/api/tmc/requests` | GET | readonly | TMC.REQUEST.VIEW | ENGINEER | E2E: auditor 403 |
| `/api/files/list` | GET | readonly | FILES.LIST | ENGINEER | E2E: (indirect) |
| `/api/files/upload` | POST | readwrite | FILES.UPLOAD | STOREKEEPER | — |
| `/api/ledger/append` | POST | readwrite | LEDGER.APPEND | MANAGER | E2E: auditor 403 |
| `/api/ledger/verify` | GET | readonly | LEDGER.READ | AUDITOR | — |

---

## Evidence map (unit / integration)

| AC / Assertion | Тест | Файл |
|----------------|------|------|
| PRAGMA baseline applied | applies PRAGMA baseline on readwrite | `__tests__/lib/db-sqlite.test.ts` |
| load_extension forbidden | loadExtension throws or is unavailable | `__tests__/lib/db-sqlite.test.ts` |
| withRetry на SQLITE_BUSY | retries on SQLITE_BUSY and eventually succeeds | `__tests__/lib/db-sqlite.test.ts` |
| withRetry fail fast на не-BUSY | throws immediately on non-BUSY error | `__tests__/lib/db-sqlite.test.ts` |
| MAX_OFFSET cap | caps offset at MAX_OFFSET | `__tests__/lib/db-sqlite.test.ts` |
| Limit cap, invalid cursor | parsePaginationParams | `__tests__/lib/pagination.test.ts` |
| Auditor 403 на write/admin | E2E smoke | `scripts/e2e-smoke.mjs` |
| Admin 200 на read/write | E2E smoke | `scripts/e2e-smoke.mjs` |
| workspace/init до readonly | E2E: init → status 200 | `scripts/e2e-smoke.mjs` |

---

## Operational constraint statement

> **DB write доступен только через human-authorized routes.**  
> Все endpoint'ы, выполняющие INSERT/UPDATE/DELETE, защищены `requirePermission`. AI-агент (если будет подключён) — read-only; физически не может вызвать write-маршруты без сессии авторизованного пользователя. Изменения в БД — результат явного действия человека (клик, подтверждение, ввод данных).
