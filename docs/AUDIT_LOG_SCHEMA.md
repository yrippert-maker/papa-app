# Audit Log Schema (SQLite / WAL)

**Назначение:** шаблон append-only аудит-журнала под SQLite с WAL mode.  
**Связь:** [lib/admin-audit.ts](../lib/admin-audit.ts), `ledger_events` в [lib/db.ts](../lib/db.ts).

---

## 1. Требования к audit log

| Требование | Реализация |
|------------|------------|
| Append-only | Нет UPDATE/DELETE; только INSERT |
| Неизменяемость | Hash-chain: каждый блок ссылается на prev_hash |
| Атрибуция | `actor_id`, `actor_email` в payload |
| Временная метка | `created_at` (datetime) |
| SQLite/WAL совместимость | Короткие транзакции; withRetry на BUSY |

---

## 2. Схема `ledger_events`

```sql
CREATE TABLE IF NOT EXISTS ledger_events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type      TEXT NOT NULL,
  payload_json    TEXT NOT NULL,
  prev_hash       TEXT,
  block_hash      TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  actor_id        TEXT
);

CREATE INDEX IF NOT EXISTS idx_ledger_created ON ledger_events(created_at);
CREATE INDEX IF NOT EXISTS idx_ledger_event_type ON ledger_events(event_type);
```

**Терминология:** везде используется `block_hash` (в БД, коде, документации). Термин `event_hash` не используется.

**Поля:**
- `id` — монотонно растёт; не переиспользуется
- `event_type` — тип события (USER_CREATED, FILE_REGISTERED, …)
- `payload_json` — JSON; без паролей, токенов, секретов (MUST be canonical per §3)
- `prev_hash` — SHA-256 hex предыдущего блока; NULL для genesis
- `block_hash` — SHA-256 hex по нормативу §4 (§4.2 для legacy)
- `actor_id` — user id; NULL для legacy rows (pre-migration)
- `created_at` — UTC или локальная; детерминированно для репликации

---

## 3. Canonical JSON (обязательно для hash-chain)

**MUST:** `payload_json` MUST be canonicalized at write time. Two semantically equivalent JSON objects MUST produce identical strings; otherwise hash-chain verification will fail. This applies to both normative and legacy formulas (§4, §4.2).

**Проблема:** без каноникализации два окружения могут посчитать разные хэши на «одинаковом по смыслу» payload.

**Чеклист (implementation-ready):**

| Требование | Реализация |
|------------|------------|
| Сортировка ключей | Лексикографическая по Unicode code points (ascending); одинаковая во всех Node-окружениях |
| Форматирование | Без пробелов, без переносов (`JSON.stringify(obj)` без отступов) |
| Кодировка | Строго UTF-8 |
| Числа | Без лишних нулей; целые — как integer, не `1.0` |
| Строки | Экранирование по RFC 8259 |
| null/undefined | `undefined` → опускать ключ; `null` → `null` |

**Рекомендация (Node):**
```javascript
// Каноническая сериализация для hash-chain
function canonicalJSON(obj) {
  return JSON.stringify(obj, Object.keys(obj).sort());
}
// Или: deterministic-stringify, json-canonicalize (npm)
```

**Валидация:** перед записью проверять, что `JSON.parse(payload_json)` и повторная каноникализация дают тот же JSON (round-trip).

---

## 4. Hash input canonicalization (normative)

For each `ledger_events` record, the event hash MUST be computed over the following canonical input string:

```
hash_input = event_type + "\n" + ts_utc + "\n" + actor_id + "\n" + canonical_json(payload) + "\n" + prev_hash
```

Where:
- `event_type` — the `event_type` column value (e.g. `USER_CREATED`)
- `ts_utc` — ISO 8601 UTC timestamp (e.g. `2026-02-01T12:14:43Z`); binds creation time to the hash
- `actor_id` — user id of the actor (empty string `""` for system events)
- `canonical_json(payload)` — the payload serialized per §3 (sorted keys, no whitespace, UTF-8)
- `prev_hash` — see norm below
- `"\n"` — literal newline character (U+000A)

### 4.1 prev_hash norm

| Контекст | Требование |
|----------|------------|
| Первое событие (genesis) | `prev_hash` MUST be `NULL` in the database column |
| При вычислении хэша | `prev_hash` is treated as `""` when `NULL` |
| Последующие события | `prev_hash` = hex (lower-case) of previous row's `block_hash` |

Implementation MUST use `const prev = prev_hash ?? ''` before concatenation. Storage: genesis row stores `NULL`; all others store the hex string.

### 4.2 Legacy verification

For events with `actor_id IS NULL` (pre-migration rows), hash verification uses the legacy canonicalization rule:

```
hash_input_legacy = event_type + "\n" + payload_json + "\n" + prev_hash_normalized
```

Where `prev_hash_normalized` = `""` when column value is `NULL`. `payload_json` MUST be canonical (§3) — same as normative formula. No `ts_utc` or `actor_id` in the legacy formula. Implementations (e.g. `verifyLedgerChain`) MUST detect `actor_id IS NULL` and apply this rule instead of the normative formula above.

### 4.3 Example (3 events, verification walkthrough)

| id | event_type | prev_hash (DB) | actor_id | Rule | prev in hash |
|----|------------|----------------|----------|------|--------------|
| 1 | GENESIS | `NULL` | `NULL` | legacy | `""` |
| 2 | LEGACY_EVENT | `block_hash[1]` | `NULL` | legacy | — |
| 3 | USER_CREATED | `block_hash[2]` | `"1"` | normative | — |

- **Event 1 (genesis):** `prev_hash` column = `NULL` → at hash time treated as `""`; `actor_id IS NULL` → legacy formula.
- **Event 2 (legacy):** `actor_id IS NULL` → legacy formula; chain link: `prev_hash` = `block_hash[1]`.
- **Event 3 (new):** `actor_id != NULL` → normative formula; chain link: `prev_hash` = `block_hash[2]`.

**Algorithm and output:**
- Hash algorithm: SHA-256
- Input encoding: UTF-8
- Output format: hex, lower-case, 64 characters

**MUST:** All implementations MUST produce identical `block_hash` for identical `hash_input`. No other concatenation order or encoding is permitted.

---

## 5. Hash-chain

```
block_hash = SHA256(event_type + "\n" + ts_utc + "\n" + actor_id + "\n" + canonical_payload_json + "\n" + prev_hash)
```

Где `canonical_payload_json` — **canonical JSON** (см. §3); `prev_hash` — hex; вывод — hex lower-case.

**Проверка целостности:**
```sql
-- Псевдокод: для каждой строки i > 1
-- recalc = hash(event_type, payload_json, prev_hash_from_row[i-1])
-- assert recalc == block_hash
```

---

## 6. Типы событий (admin / ledger)

| event_type | Описание | payload (ключи) |
|------------|----------|-----------------|
| USER_CREATED | Создан пользователь | actor_id, actor_email, target_email, role_code |
| USER_ROLE_CHANGED | Смена роли | actor_id, actor_email, target_id, target_email, old_role, new_role |
| USER_PASSWORD_RESET | Сброс пароля | actor_id, actor_email, target_id, target_email |
| USER_CREATE_DENIED | Отказ создания | actor_id, actor_email, target_email, reason |
| USER_ROLE_CHANGE_DENIED | Отказ смены роли | actor_id, actor_email, target_id, target_email, reason |
| FILE_REGISTERED | Регистрация файла | action, relative_path, checksum_sha256 |

---

## 7. PRAGMA и транзакции (WAL)

- `journal_mode=WAL` — один writer, много readers
- `busy_timeout=5000` — ожидание блокировки
- Короткие транзакции: один INSERT за раз (или логичная батчевая вставка)
- Retry на SQLITE_BUSY — см. [lib/db/sqlite.ts](../lib/db/sqlite.ts) `withRetry`

---

## 8. Расширение (будущее)

При добавлении доменных событий (ТМЦ, заявки, техкарты):

1. Новый `event_type` — добавить в перечисление
2. `payload_json` — фиксированная структура (schema validation)
3. Без изменения существующих записей
4. Миграции — только ADD COLUMN для опциональных полей (если нужно), не меняя старых строк

---

## 9. Политика времени

| Требование | Реализация |
|------------|------------|
| Источник timestamp | Серверное время (не клиент) |
| Формат | ISO 8601 или epoch (INTEGER); предпочтительно UTC |
| Монотонность | Опционально: отклонять запись, если `created_at` < последнего |

---

## 10. Hash в триггере vs application layer

**Рекомендация: оставить вычисление `block_hash` в application layer.**

| Фактор | Триггер (SQLite) | Application layer |
|--------|------------------|-------------------|
| **SHA-256** | Нет в ядре SQLite; нужен extension или UDF. UDF регистрируется на соединение — при INSERT из sqlite3 CLI или другого клиента триггер упадёт (no such function). | `crypto.createHash` в Node — всегда доступен. |
| **Canonical JSON** | SQLite не гарантирует сортировку ключей. Триггер использует `payload_json` как есть — приложение должно вставлять уже канонический JSON. | Приложение контролирует сериализацию и валидирует round-trip. |
| **Один источник правды** | Логика в SQL + дубликат в коде при миграциях. | `lib/ledger-hash.ts` — единая точка. |
| **PostgreSQL (P2)** | Другой триггер, `pgcrypto`. | Тот же `computeEventHash`. |
| **Проверяемость** | Триггер сложнее тестировать. | Unit-тесты для `computeEventHash`, `verifyLedgerChain`. |
| **Явность** | Триггер срабатывает "в фоне". | Вызов `computeEventHash` виден в коде и при ревью. |

**Итог:** вычисление хэша остаётся в application layer (`lib/ledger-hash.ts`, `lib/admin-audit.ts`, `app/api/ledger/append`, `app/api/files/upload`). Триггер не используется.

**Псевдокод триггера (если бы SQLite имел `sha256_hex`):**
```sql
-- НЕ РЕКОМЕНДУЕТСЯ: требует UDF sha256_hex, не портируемо
CREATE TRIGGER ledger_compute_hash BEFORE INSERT ON ledger_events
BEGIN
  SELECT CASE
    WHEN NEW.block_hash IS NULL OR NEW.block_hash = '' THEN
      (SELECT sha256_hex(NEW.event_type || char(10) || NEW.payload_json || char(10) || coalesce(
        (SELECT block_hash FROM ledger_events ORDER BY id DESC LIMIT 1), ''
      )))
    ELSE NEW.block_hash
  END INTO NEW.block_hash;
END;
```
Проблема: `sha256_hex` — не встроенная функция SQLite; при INSERT из другого клиента триггер упадёт.

---

## 11. Резервная проверка SQLite compile options

Если регулятор запросит compile options SQLite:
```bash
node -e "
const Database = require('better-sqlite3');
const db = new Database(':memory:');
console.log(db.prepare('PRAGMA compile_options').all().map(r => r.compile_options).join('\n'));
db.close();
"
```
