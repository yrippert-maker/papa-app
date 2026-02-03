# ADR-003: Контракты DB и Storage адаптеров

**Дата:** 2026-02-01  
**Статус:** Accepted

---

## Контекст

P2-Core предполагает миграцию на PostgreSQL и S3-compatible storage. Чтобы не переписывать доменную логику, вводим абстракции с фиксированными контрактами. Интерфейсы задают границу — код выше не знает, SQLite или Postgres, FS или S3.

## Решение

### DbAdapter

| Метод | Сигнатура | Назначение |
|-------|-----------|------------|
| `prepare(sql)` | `DbPreparedStatement` | Подготовка запроса; совместимость с `db.prepare().run/get/all` |
| `exec(sql)` | `void` | DDL, batch SQL |
| `transaction(fn)` | `T` | Атомарное выполнение; rollback при ошибке |
| `healthCheck()` | `Promise<boolean>` | Readiness probe |

**DbPreparedStatement:** `run(...params)`, `get<T>(...params)`, `all<T>(...params)` — семантика better-sqlite3.

### StorageAdapter

| Метод | Сигнатура | Назначение |
|-------|-----------|------------|
| `put(key, buffer)` | `Promise<void>` | Запись; key = relative_path |
| `get(key)` | `Promise<Buffer \| null>` | Чтение |
| `list(prefix?)` | `Promise<StorageEntry[]>` | Список по префиксу |
| `delete(key)` | `Promise<void>` | Удаление |
| `healthCheck()` | `Promise<boolean>` | Readiness probe |

**StorageEntry:** `{ key, size?, isDir? }`.

**Семантика key и list:**
- `key` — POSIX path (`/`), без `..`, без `\`. Всегда relative_path.
- `list(prefix)` — плоский список по префиксу, не рекурсивное дерево.
- `isDir` — UX-флаг (S3 не имеет директорий; FS — да); не гарантируется для S3.

## Альтернативы

| Вариант | Плюсы | Минусы | Почему не выбран |
|---------|-------|--------|------------------|
| ORM (Prisma, Drizzle) | Типобезопасность | Миграция всего кода, lock-in | Избыточно для текущего объёма |
| Raw SQL без prepare | Простота | Потеря параметризации, SQL injection risk | Неприемлемо |
| Разные API для FS и S3 | Нативная оптимизация | Дублирование логики в API routes | Нарушает DRY |

## Последствия

- **Код:** `lib/adapters/types.ts` — интерфейсы; реализация в US-P2-1, US-P2-4.
- **Риск:** не все операции better-sqlite3 могут иметь 1:1 эквивалент в Postgres; возможно, появятся небольшие обёртки.
- **Тесты:** mock-адаптеры для unit-тестов без реальной БД/FS.
