# PR Review & Acceptance: US-7, US-8

Чеклисты для ревью и финальной приёмки после реализации.

## Как использовать

1. Скопировать чеклист из документа в описание PR по US-7/US-8.
2. Отмечать пункты по мере ревью.
3. Не принимать PR, пока все пункты не закрыты или явно не помечены как accepted risk.

---

## US-7: Пагинация

### Code Review

- [ ] **Контракт API** — единый: `limit`, `cursor` (или `offset`), ответ `items` + `nextCursor`/`nextOffset`
- [ ] **Limit cap** — max 100 enforced сервером; default разумный (10–50)
- [ ] **Сортировка** — `created_at DESC, id DESC` (или эквивалент) везде
- [ ] **Invalid cursor** — возврат 400 с понятным сообщением
- [ ] **Без дублей** — cursor-based не пропускает и не дублирует строки при вставках
- [ ] **Endpoints** — `/api/admin/users`, `/api/tmc/items`, `/api/tmc/lots`, `/api/tmc/requests`, `/api/files/list` (по scope)

### Acceptance

- [ ] Unit: limit cap enforced; invalid cursor → 400
- [ ] E2E: первая страница + следующая — непрерывный набор без дублей
- [ ] Минимальный UI (Load more / пагинатор) на хотя бы одном списке

### Риски

- COUNT(*) для `total` — если добавлен, не блокирует при больших таблицах
- Cursor encoding — cursor должен быть безопасным (base64/opaque), не раскрывать внутреннюю структуру

---

## US-8: SQLite Safe Mode

### Code Review

- [ ] **WAL** — `PRAGMA journal_mode=WAL` при инициализации
- [ ] **busy_timeout** — `PRAGMA busy_timeout=5000` (или эквивалент)
- [ ] **Транзакции** — короткие; нет долгих BEGIN…COMMIT
- [ ] **Retry** — 2–3 попытки с backoff+jitter на SQLITE_BUSY
- [ ] **Логирование** — SQLITE_BUSY логируется (level warn/error)
- [ ] **Пути** — ledger append, admin create/patch, file upload обёрнуты в retry/transaction

### Acceptance

- [ ] Unit/integration: имитация SQLITE_BUSY → retry успешен или 503 с понятным сообщением
- [ ] Code review: нет длинных транзакций

### Риски

- better-sqlite3 синхронный — retry на уровне вызова, не внутри одной операции
- Множественные writer'ы — при высокой конкуренции 503 допустим; важно не терять данные

---

## Порядок приёмки

1. Ревью по чеклисту
2. `npm test` + `npm run test:e2e` зелёные
3. Ручная проверка критичных сценариев
4. Merge
