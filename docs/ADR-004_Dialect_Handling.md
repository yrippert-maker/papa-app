# ADR-004: Dialect handling (SQLite vs Postgres)

**Дата:** 2026-02-01  
**Статус:** Accepted

---

## Контекст

При поддержке SQLite и PostgreSQL неизбежны различия: placeholder-синтаксис (`?` vs `$1`), `INSERT OR IGNORE` vs `ON CONFLICT DO NOTHING`, `RETURNING`, `datetime('now')` vs `now()`. Разбрасывать `if (postgres)` по коду — антипаттерн. Нужна явная точка различия.

## Решение

### DbAdapter.dialect

Каждый DbAdapter объявляет свой диалект:

```ts
DbAdapter.dialect: 'sqlite' | 'postgres'
```

Код выше adapter'а **не проверяет dialect** — adapter при `prepare()` сам приводит SQL и параметры к формату своей БД. Вся логика различий инкапсулирована в adapter.

### DbAdapter.capabilities (опционально)

Для случаев, когда вызывающему коду нужна информация о возможностях:

```ts
DbAdapter.capabilities: {
  returning: boolean;   // RETURNING clause
  onConflict: boolean;  // ON CONFLICT DO NOTHING/UPDATE
  lastInsertId: 'lastval' | 'last_insert_rowid'; // способ получения
}
```

По умолчанию: вызывающий код **не использует** capabilities. Они нужны только если внутри adapter'а недостаточно (например, миграционный скрипт должен формировать разный SQL).

### Рекомендация: dialect helpers внутри adapter

Adapter принимает SQL в **канонической форме** (например, `?` placeholders, `RETURNING id`) и сам преобразует:

- SqliteAdapter: `?` остаётся; `RETURNING` → поддерживается (3.35+); `ON CONFLICT` → `OR IGNORE` / `OR REPLACE` при необходимости.
- PostgresAdapter: `?` → `$1, $2, ...`; `RETURNING` как есть; `ON CONFLICT DO NOTHING` как есть.

**Единый источник SQL:** миграции и запросы в коде пишутся в одном формате; adapter выполняет преобразование. По возможности — один SQL с conditional части через небольшой helper, а не два файла.

## Альтернативы

| Вариант | Плюсы | Минусы | Почему не выбран |
|---------|-------|--------|------------------|
| Два набора SQL (sqlite.sql, pg.sql) | Простота per-dialect | Дублирование, расхождение | Взрыв поддержки |
| Query builder (Knex, etc.) | Абстракция | Зависимость, миграция кода | Избыточно |
| Только Postgres | Один диалект | Потеря SQLite для dev/CI | Нужна обратная совместимость |

## Последствия

- **lib/adapters/types.ts:** `DbAdapter` расширен полем `dialect` и опционально `capabilities`.
- **SqliteAdapter / PostgresAdapter:** реализуют преобразование при `prepare()`.
- **Миграции:** единый формат; при неизбежных различиях — conditional в migrate script по `dialect`, не по коду приложения.
- **Код:** никаких `process.env.DB_PROVIDER` вне adapter.
