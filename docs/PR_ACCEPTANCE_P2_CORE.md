# PR Acceptance: P2-Core

Чеклисты для ревью и приёмки P2-Core (US-P2-1 … US-P2-7).

## Как использовать

1. Скопировать релевантный чеклист в описание PR.
2. Отмечать пункты по мере ревью.
3. Не принимать PR, пока все пункты не закрыты или явно не помечены как accepted risk.

---

## Code rules (все US-P2)

- Запрещены `if (dialect)` / `if (DB_PROVIDER)` вне adapter (кроме тестов).
- Несовместимости SQL — только внутри adapter через helper'ы: `buildInsertIgnore()`, `buildReturning()`, `getLastInsertId()`.

---

## US-P2-1: SqliteAdapter extraction

### Code Review

- [ ] `npm run check:db-imports` проходит (нет импортов better-sqlite3/pg вне lib/adapters/).
- [ ] Все запросы идут через `prepare/run/get/all` или `exec`.
- [ ] `getDb()` возвращает `DbAdapter`, не raw Database.
- [ ] `healthCheck()` возвращает статус (например, `SELECT 1`).

### Acceptance

- [ ] Существующий код работает без поведенческих изменений.
- [ ] Unit + E2E проходят.

---

## US-P2-2: PostgresAdapter + схема

### Code Review

- [ ] `PostgresAdapter` реализует `DbAdapter` с `dialect: 'postgres'`.
- [ ] Placeholder `?` → `$1, $2, ...` (внутри adapter).
- [ ] Миграции: единый источник или dialect-conditional, без дублирования.
- [ ] `DATABASE_URL` в env.example.

### Acceptance

- [ ] `DB_PROVIDER=postgres` + `DATABASE_URL` — приложение стартует.
- [ ] Миграции up применяются без ошибок.
- [ ] E2E smoke проходит на Postgres (опционально).

---

## US-P2-3: SQLite → Postgres migration script

### Code Review

- [ ] Скрипт в одной транзакции; rollback при ошибке.
- [ ] Порядок таблиц: rbac_* → users → file_registry → ledger_events → tmc_*.
- [ ] `ledger_events` переносится по `id ASC`.
- [ ] Dry-run режим.
- [ ] Проверка: Postgres пуст или `--force`.

### Acceptance (шаблон миграционного скрипта)

| # | Проверка | Ожидание |
|---|----------|----------|
| 1 | **Counts** | `SELECT COUNT(*)` по каждой таблице — совпадает с SQLite |
| 2 | **Hash-chain** | Пройти `ledger_events` по `id ASC`; для каждой записи: `block_hash === hash(event_type + payload_json + prev_hash)` |
| 3 | **Выборочная сверка** | Минимум 3 таблицы (users, ledger_events, file_registry): сравнить 1–5 записей по id |
| 4 | **Идемпотентность** | Повторный запуск на пустой Postgres — успех; на непустой без `--force` — отказ |
| 5 | **Rollback** | При ошибке в середине — Postgres в состоянии до транзакции |
| 6 | **FK/constraints** | Нет orphan rows по ключевым FK; при необходимости — `PRAGMA foreign_key_check` (SQLite) / выборочные запросы в Postgres |

### Риски (см. MIGRATION_RISKS.md)

- Бэкап SQLite перед миграцией.
- Не удалять SQLite до успешного переключения на v0.2.0.

---

## US-P2-4: Storage abstraction

### Code Review

- [ ] `StorageAdapter` с `put/get/list/delete/healthCheck`.
- [ ] `FsAdapter` — backward compatible с WORKSPACE_ROOT.
- [ ] `key` — POSIX path, без `..`.
- [ ] `list(prefix)` — плоский список.

### Acceptance

- [ ] `STORAGE_PROVIDER=fs` — поведение как сейчас.
- [ ] `STORAGE_PROVIDER=s3` — upload/list с MinIO/S3.
- [ ] Key normalization: reject `..`, `\`; нормализация в POSIX path.
- [ ] Invalid key → ошибка (400 или throw), не silent accept.

---

## US-P2-5: Files → S3 migration

### Code Review

- [ ] Для каждой записи в file_registry: read FS → put S3 → verify checksum.
- [ ] Идемпотентность: skip если ключ уже в S3 (опционально).
- [ ] `--delete-local` только после успешного прогона.

### Acceptance (шаблон миграционного скрипта)

| # | Проверка | Ожидание |
|---|----------|----------|
| 1 | **Counts** | Количество объектов в S3 (по prefix) = количество в file_registry |
| 2 | **Checksums** | Для каждого файла: checksum после GetObject совпадает с file_registry.checksum_sha256 |
| 3 | **Размеры** | Размер (bytes) совпадает с ожидаемым |
| 4 | **Идемпотентность** | Повторный запуск не дублирует и не перезаписывает без необходимости |
| 5 | **Реестр** | file_registry не изменён (paths те же) |
| 6 | **Read-back** | Выбрать N файлов (3–10); GetObject + checksum — скачанное совпадает с ожидаемым |

---

## US-P2-6: Health/readiness

### Code Review

- [ ] `/api/health` — liveness, без auth.
- [ ] `/api/health/ready` — БД + storage healthCheck.
- [ ] Middleware не защищает эти маршруты.

### Acceptance

- [ ] 200 при доступных БД и storage.
- [ ] 503 (или degraded) при недоступности.

---

## US-P2-7: Backup strategy

### Code Review

- [ ] Скрипт: pg_dump + список объектов S3 (или sync в backup bucket).
- [ ] docs/BACKUP_RESTORE.md — процедура восстановления.

### Acceptance

- [ ] Восстановимый бэкап.
- [ ] Документация актуальна.
