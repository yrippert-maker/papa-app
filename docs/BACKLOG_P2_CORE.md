# Backlog: P2-Core — Масштабирование и надёжность

## Цель — >30–100 пользователей, устойчивость при росте

**Источник:** ARCHITECTURE_OVERVIEW.md, вариант P2-Core  
**Предварительное условие:** v0.1.0 выпущен, US-7 и US-8 выполнены (v0.1.1)  
**Рекомендованный порядок:** US-P2-1 → US-P2-2 → US-P2-3 → US-P2-4  
**Release:** v0.2.0

---

## Definition of Done (этап P2-Core)

- [ ] Доменная логика не изменена — только инфраструктурный слой
- [ ] Unit + E2E проходят для обоих вариантов (SQLite — CI default, Postgres — опционально)
- [ ] env.example и документация обновлены
- [ ] Миграция данных задокументирована (SQLite → Postgres)

---

## EPIC P2-1: Миграция на PostgreSQL

**Цель:** уйти от ограничений SQLite при конкурирующих write, подготовить к горизонтальному масштабированию.

---

### US-P2-1: Абстракция доступа к БД (DB adapter)

| Поле | Значение |
|------|----------|
| **ID** | P2-US-1 |
| **Timebox** | 4–6 ч |
| **Зависимости** | — |

**Scope:**
- Интерфейс `DbAdapter` с методами: `query`, `run`, `transaction`
- Реализация `SqliteAdapter` (обёртка над better-sqlite3)
- `getDb()` возвращает adapter; `lib/db.ts` переключается по `DB_PROVIDER=sqlite|postgres`
- Для Postgres: `pg` или `postgres` (node-postgres)

**Acceptance criteria:**
- [ ] Существующий код работает через SqliteAdapter без поведенческих изменений
- [ ] `npm run check:db-imports` проходит; добавить в CI
- [ ] Unit-тесты проходят (с моками или SQLite in-memory)
- [ ] Переменная `DB_PROVIDER` управляет выбором

**Технические заметки:**
- Интерфейсы: `lib/adapters/types.ts` (DbAdapter, DbPreparedStatement)
- См. [ADR-003_Adapter_Contracts.md](ADR-003_Adapter_Contracts.md)
- Миграции: отдельный runner, поддержка обоих диалектов (или только Postgres в P2)

---

### US-P2-2: PostgreSQL adapter и схема

| Поле | Значение |
|------|----------|
| **ID** | P2-US-2 |
| **Timebox** | 6–8 ч |
| **Зависимости** | US-P2-1 |

**Scope:**
- `PostgresAdapter` — реализация через node-postgres
- Миграции в формате, совместимом с Postgres (SERIAL/BIGSERIAL вместо AUTOINCREMENT, и т.п.)
- Переменные: `DATABASE_URL` для Postgres
- Схема: те же таблицы (users, rbac_*, ledger_events, file_registry, tmc_*)

**Acceptance criteria:**
- [ ] `DB_PROVIDER=postgres` + `DATABASE_URL` — приложение стартует
- [ ] Миграции up применяются без ошибок
- [ ] E2E smoke проходит на Postgres (опциональный CI job)

**Технические заметки:**
- SQLite-специфичный синтаксис (AUTOINCREMENT, datetime('now')) заменить на Postgres-эквиваленты
- Либо два набора миграций, либо единый с conditional SQL (рекомендация: отдельные `.postgres.sql` или диалект в migrate script)
- См. [ADR-002_SQLite_to_PostgreSQL.md](ADR-002_SQLite_to_PostgreSQL.md), [ADR-004_Dialect_Handling.md](ADR-004_Dialect_Handling.md)

---

### US-P2-3: Миграция данных SQLite → Postgres (скрипт)

| Поле | Значение |
|------|----------|
| **ID** | P2-US-3 |
| **Timebox** | 4–6 ч |
| **Зависимости** | US-P2-2 |

**Scope:**
- Скрипт `scripts/migrate-sqlite-to-postgres.mjs`: чтение из SQLite, запись в Postgres
- Таблицы по порядку (FK constraints): rbac_* → users → file_registry → ledger_events → tmc_*
- Идемпотентность: проверка на пустую Postgres или флаг `--force`
- Dry-run режим

**Acceptance criteria:** см. [PR_ACCEPTANCE_P2_CORE.md](PR_ACCEPTANCE_P2_CORE.md) (шаблон US-P2-3).

- [ ] Скрипт переносит данные без потери
- [ ] Хеш-цепочка ledger остаётся валидной (проверка block_hash)
- [ ] Документация: пошаговая инструкция в docs/

**Технические заметки:**
- Порядок важен из-за FK
- Пароли (bcrypt) переносятся как есть

---

## EPIC P2-2: Object Storage для файлов

**Цель:** вынести файлы из локального FS в S3-compatible storage для масштабируемости и durability.

---

### US-P2-4: Storage abstraction (S3-compatible)

| Поле | Значение |
|------|----------|
| **ID** | P2-US-4 |
| **Timebox** | 6–8 ч |
| **Зависимости** | — |

**Scope:**
- Интерфейс `StorageAdapter`: `put(key, buffer)`, `get(key)`, `list(prefix)`, `delete(key)`
- Реализация `FsAdapter` — текущее поведение (WORKSPACE_ROOT)
- Реализация `S3Adapter` — AWS SDK v3 или `@aws-sdk/client-s3` (MinIO, S3, GCS S3-compat)
- Переключение: `STORAGE_PROVIDER=fs|s3`, для S3: `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT` (для MinIO), credentials

**Acceptance criteria:**
- [ ] `STORAGE_PROVIDER=fs` — поведение как сейчас (backward compatible)
- [ ] `STORAGE_PROVIDER=s3` — upload/list работают с MinIO/S3
- [ ] file_registry и ledger не меняются; путь в storage — `{prefix}/{relative_path}`

**Технические заметки:**
- Интерфейс: `lib/adapters/types.ts` (StorageAdapter). См. [ADR-003_Adapter_Contracts.md](ADR-003_Adapter_Contracts.md)
- Prefix для изоляции: `papa/{workspace_id}/` при multi-tenant

---

### US-P2-5: Миграция файлов в Object Storage

| Поле | Значение |
|------|----------|
| **ID** | P2-US-5 |
| **Timebox** | 4–6 ч |
| **Зависимости** | US-P2-4 |

**Scope:**
- Скрипт `scripts/migrate-files-to-s3.mjs`: читает file_registry + FS, загружает в S3
- Проверка checksum после переноса
- Опционально: удаление из FS после успешного переноса (флаг `--delete-local`)

**Acceptance criteria:** см. [PR_ACCEPTANCE_P2_CORE.md](PR_ACCEPTANCE_P2_CORE.md) (шаблон US-P2-5).

- [ ] Все файлы из file_registry перенесены
- [ ] checksum_sha256 совпадает
- [ ] Документация: инструкция миграции

---

## EPIC P2-3: Readiness и бэкапы

**Цель:** операционная готовность и восстановление.

---

### US-P2-6: Health и readiness checks

| Поле | Значение |
|------|----------|
| **ID** | P2-US-6 |
| **Timebox** | 2–4 ч |
| **Зависимости** | US-P2-2 |

**Scope:**
- `GET /api/health` — liveness (доступен ли сервер)
- `GET /api/health/ready` — readiness: БД подключена, storage доступен
- Без auth (для k8s/load balancer probes)
- Ответ JSON: `{ status: 'ok' | 'degraded' | 'unhealthy', checks?: {...} }`

**Acceptance criteria:**
- [ ] `/api/health` возвращает 200
- [ ] `/api/health/ready` возвращает 200 только если БД и storage доступны
- [ ] Middleware не защищает эти маршруты

**Технические заметки:**
- Matcher в middleware: исключить `/api/health`, `/api/health/ready`

---

### US-P2-7: Backup strategy (документация + скрипт)

| Поле | Значение |
|------|----------|
| **ID** | P2-US-7 |
| **Timebox** | 2–4 ч |
| **Зависимости** | US-P2-2, US-P2-4 |

**Scope:**
- `scripts/backup.mjs`: dump Postgres (pg_dump) + список объектов S3 (или sync в backup bucket)
- Документ `docs/BACKUP_RESTORE.md`: частота, retention, процедура восстановления
- Без автоматического scheduling (cron/systemd — на стороне оператора)

**Acceptance criteria:**
- [ ] Скрипт создаёт восстановимый бэкап
- [ ] Документация: как восстановить

---

## Сводка по оценке

| US | Описание | Часы |
|----|----------|------|
| US-P2-1 | DB adapter (Sqlite) | 4–6 |
| US-P2-2 | Postgres adapter, схема | 6–8 |
| US-P2-3 | Миграция SQLite→Postgres | 4–6 |
| US-P2-4 | Storage abstraction (FS + S3) | 6–8 |
| US-P2-5 | Миграция файлов в S3 | 4–6 |
| US-P2-6 | Health/readiness | 2–4 |
| US-P2-7 | Backup strategy | 2–4 |
| **Итого** | | **28–42** |

---

## Порядок релиза

1. **v0.1.1** — US-7, US-8 (P1 завершение)
2. **v0.2.0** — P2-Core (Postgres + Storage + Health + Backup)
