# Backlog: Приоритет 1
## Цель — 30+ пользователей и допуски по ролям

**Источник:** ARCHITECTURE_OVERVIEW.md, Приоритет 1  
**Рекомендованный порядок:** US-1 → US-2 → US-3 → US-4 → US-5 → US-7 → US-8; US-6 — параллельно/после  
**Спринты:** [SPRINT_P1.md](SPRINT_P1.md) | **Бриф разработчику:** [DEV_BRIEF_P1.md](DEV_BRIEF_P1.md)

---

## Definition of Done (этап P1)

- [x] Все unit-тесты проходят; e2e-smoke расширен под новые сценарии (403, роли)
- [x] Миграции БД с up/down; нет plaintext паролей
- [x] Документация: обновлён ARCHITECTURE_OVERVIEW, env.example
- [x] Security: policy layer на всех защищённых endpoint; 401/403 разведены
- [x] Code review: нет «ручных if» проверки прав в endpoint’ах

---

## EPIC P1-1: Модель пользователей и RBAC в приложении

**Цель:** перейти от single-user к users/roles/permissions, применяемым на API и UI.

---

### US-1: Таблица пользователей и связей ролей

| Поле | Значение |
|------|----------|
| **ID** | P1-US-1 |
| **Timebox** | 4–6 ч |
| **Зависимости** | — |

**Scope:**
- Добавить сущности: `users`, `user_roles` (или `user.role_id`). Роли `rbac_role` уже есть.
- Миграции БД (up/down).
- Сидирование ролей: `admin`, `manager`, `storekeeper`, `engineer`, `auditor`.

**Acceptance criteria:**
- [x] Есть миграции (up/down) и сид ролей
- [x] Минимум один user может быть назначен в роль
- [x] Схема индексирована: `user_id`, `role_id`

**Технические заметки:**
- Таблицы `rbac_role`, `rbac_permission`, `rbac_role_permission` уже существуют
- Добавить `users` (id, email, password_hash, role_code или FK на rbac_role, created_at)
- Миграции: SQL-файлы или node script

---

### US-2: Policy/Authorization слой (единая точка)

| Поле | Значение |
|------|----------|
| **ID** | P1-US-2 |
| **Timebox** | 4–6 ч |
| **Зависимости** | US-1 |

**Scope:**
- Модуль `lib/authz`: `can(user, action)` или middleware `requirePermission(perm_code)`
- Матрица разрешений: `workspace:read`, `files:list`, `files:upload`, `ledger:append`, `admin:manageUsers`
- Маппинг роль → permissions через `rbac_role_permission`

**Acceptance criteria:**
- [x] Все защищённые API используют policy слой (запрещено «ручное if» в endpoint)
- [x] Логи и ошибки: 401 (не залогинен), 403 (нет прав)

**Технические заметки:**
- `getUserPermissions(session)` → load from rbac_role_permission
- Хелпер `requirePermission(perm)(handler)` для оборачивания API

---

### US-3: Применение RBAC к API (MVP покрытие)

| Поле | Значение |
|------|----------|
| **ID** | P1-US-3 |
| **Timebox** | 4–6 ч |
| **Зависимости** | US-2 |

**Scope:**
- Проставить permissions на endpoint’ы:
  - `/api/workspace/status` — `workspace:read` (или public для health — решить явно)
  - `/api/files/*` — `files:list`, `files:upload`
  - `/api/ledger/*` — `ledger:append`, `ledger:read`
- Обновить middleware matcher при необходимости

**Acceptance criteria:**
- [x] Для каждого endpoint описана требуемая permission
- [x] e2e-smoke расширен: auditor 403 на TMC.MANAGE, LEDGER.APPEND (cookie jar)

**Технические заметки:**
- Решение: `/api/workspace/status` — защищён, т.к. раскрывает путь; health — отдельный `/api/health` если нужен

---

## EPIC P1-2: Миграция аутентификации

**Цель:** уйти от fixed creds, сделать аутентификацию пригодной для 30+ пользователей.

---

### US-4: Credentials auth на базе users table

| Поле | Значение |
|------|----------|
| **ID** | P1-US-4 |
| **Timebox** | 6–8 ч |
| **Зависимости** | US-1 |

**Scope:**
- Credentials provider проверяет логин/пароль по `users` (bcrypt/argon2)
- Убрать AUTH_USER, AUTH_PASSWORD из authorize()
- Сессия: user id, role, permissions (или load on demand)

**Acceptance criteria:**
- [x] Нельзя залогиниться, если пользователя нет в БД
- [x] Нет plaintext паролей в БД и логах
- [x] Тесты: успешный и неуспешный логин

**Технические заметки:**
- bcrypt или argon2 для хешей
- Миграция: создать первого admin через seed или CLI

---

### US-5: Admin UI для управления пользователями (минимальный)

| Поле | Значение |
|------|----------|
| **ID** | P1-US-5 |
| **Timebox** | 8–12 ч |
| **Зависимости** | US-4, US-3 |

**Scope:**
- Страница «Users» (только admin): создать, назначить роль, сбросить пароль
- Можно без сложного UI, важна функциональность

**Acceptance criteria:**
- [x] Доступ только при `ADMIN.MANAGE_USERS`
- [x] Операции логируются (USER_CREATED, USER_ROLE_CHANGED, USER_PASSWORD_RESET в ledger)

**Технические заметки:**
- Добавить `audit_log` или использовать ledger для sensitive actions
- Сброс пароля: генерация временного или reset token (email — опционально позже)

---

### US-6 (опционально): OAuth/SSO — ADR

| Поле | Значение |
|------|----------|
| **ID** | P1-US-6 |
| **Timebox** | 2–4 ч |
| **Зависимости** | — |

**Scope:**
- Исследовать провайдера (Google/Microsoft/Keycloak)
- Короткий ADR: Credentials vs OAuth для контекста papa-app
- Без внедрения в код

**Acceptance criteria:**
- [ ] ADR: рекомендация и шаги при необходимости OAuth

---

## EPIC P1-3: Пагинация и нагрузочная пригодность

**Цель:** не «убить» UI/API при росте данных, сохраняя SQLite.

---

### US-7: Пагинация (минимальный дизайн)

| Поле | Значение |
|------|----------|
| **ID** | P1-US-7 |
| **Timebox** | 6–8 ч |
| **Зависимости** | — |

**Scope:**
- Унифицированный контракт API: `limit`, `cursor` (или `offset` — если проще)
- Ответ: `items: [...]`, `nextCursor: string | null` (или `nextOffset`), `total?: number` (опционально)
- Endpoints: `/api/files/list`, `/api/tmc/items`, `/api/tmc/lots`, `/api/tmc/requests`, `/api/admin/users`
- UI: «Load more» или простой пагинатор на списках (без расширения scope — минимум)

**Hard rules:**
- `limit` capped сервером (max 100)
- Сортировка детерминированная: `created_at DESC, id DESC`
- Для files/ledger — cursor предпочтительнее offset (меньше сюрпризов при вставках)

**Acceptance criteria:**
- [x] Unit: limit cap enforced; invalid cursor → 400
- [x] E2E: pagination (admin/users); первая + следующая страница без дублей

**Технические заметки:**
- Cursor: base64(last_id) для admin/users; offset для tmc/files
- `total` — опционально (COUNT может быть дорогим)
- БД не меняем; только изменение API и UI-клиента

---

### US-8: SQLite safe mode (минимально)

| Поле | Значение |
|------|----------|
| **ID** | P1-US-8 |
| **Timebox** | 4–6 ч |
| **Зависимости** | — |

**Scope:**
- Предсказуемое поведение при конкурирующих write без миграции на Postgres

**Минимальный пакет:**
1. WAL и busy_timeout: `PRAGMA journal_mode=WAL;`, `PRAGMA busy_timeout=5000;`
2. Короткие транзакции на write-path (ledger append, admin actions)
3. Retry/backoff на `SQLITE_BUSY` (2–3 попытки с джиттером)
4. Метрика/лог на `SQLITE_BUSY` (наблюдаемость)

**Acceptance criteria:**
- [x] Unit/integration: имитация SQLITE_BUSY → успешный retry
- [x] PRAGMA baseline, load_extension forbidden, read-only для read-endpoints
- [x] docs/REGULATOR_PACKAGE.md — раздел SQLite Safe Mode

**Технические заметки:**
- better-sqlite3: `db.pragma('busy_timeout', 5000)` при инициализации
- Retry: экспоненциальный backoff с jitter, max 2–3 попытки
- Критичные пути: ledger append, admin user create/patch, file upload

---

## Сводка по оценке

| US | Описание | Часы |
|----|----------|------|
| US-1 | Таблица users, миграции, сид ролей | 4–6 |
| US-2 | Policy слой lib/authz | 4–6 |
| US-3 | RBAC на API, e2e 403 | 4–6 |
| US-4 | Credentials из users table | 6–8 |
| US-5 | Admin UI Users | 8–12 |
| US-6 | ADR OAuth (опц.) | 2–4 |
| US-7 | Пагинация API | 6–8 |
| US-8 | SQLite safe mode | 4–6 |
| **Итого** | | **38–56** |

**Минимальный набор (EPIC P1-1 + US-4):** US-1, US-2, US-3, US-4 ≈ 18–26 ч
