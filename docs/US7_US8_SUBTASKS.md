# US-7 / US-8: Подзадачи с timebox

## US-7: Пагинация (6–8 ч)

| # | Подзадача | Timebox | Зависимости |
|---|-----------|---------|-------------|
| 7.1 | Общий хелпер `parsePaginationParams(limit?, cursor?)` — валидация, cap 100, парсинг cursor | 1 ч | — |
| 7.2 | API `/api/admin/users`: добавить `limit`, `cursor`; ответ `items`, `nextCursor` | 1 ч | 7.1 |
| 7.3 | API `/api/tmc/items`, `/api/tmc/lots`, `/api/tmc/requests`: pagination | 1.5 ч | 7.1 |
| 7.4 | API `/api/files/list`: pagination (cursor по relative_path или id) | 1 ч | 7.1 |
| 7.5 | Unit: limit cap, invalid cursor → 400 | 0.5 ч | 7.1 |
| 7.6 | E2E: первая страница + next — непрерывность, без дублей | 1 ч | 7.2–7.4 |
| 7.7 | UI: «Load more» или пагинатор на `/admin/users` (минимум) | 1–2 ч | 7.2 |

**Итого:** 7–8 ч

---

## US-8: SQLite Safe Mode (4–6 ч)

| # | Подзадача | Timebox | Зависимости |
|---|-----------|---------|-------------|
| 8.1 | `lib/db.ts`: при инициализации — `PRAGMA journal_mode=WAL`, `PRAGMA busy_timeout=5000` | 0.5 ч | — |
| 8.2 | Хелпер `withRetry<T>(fn, { maxAttempts: 3 })` с exponential backoff + jitter | 1 ч | — |
| 8.3 | Оборачивание ledger append в `withRetry` | 0.5 ч | 8.1, 8.2 |
| 8.4 | Оборачивание admin create/patch в `withRetry` | 0.5 ч | 8.2 |
| 8.5 | Оборачивание file upload (DB часть) в `withRetry` | 0.5 ч | 8.2 |
| 8.6 | Лог при SQLITE_BUSY (console.warn с контекстом) | 0.5 ч | 8.2 |
| 8.7 | Ревью транзакций — убедиться, что нет долгих BEGIN…COMMIT | 0.5 ч | — |
| 8.8 | Unit/integration: mock SQLITE_BUSY → retry успешен или 503 | 1 ч | 8.2 |

**Итого:** 4.5–5 ч

---

## Рекомендованный порядок

1. **US-7** (пагинация) — 7.1 → 7.2 → 7.5 → 7.3 → 7.4 → 7.6 → 7.7
2. **US-8** (SQLite safe) — 8.1 → 8.2 → 8.3 → 8.4 → 8.5 → 8.6 → 8.7 → 8.8

Можно параллелить: один разработчик — US-7, другой — US-8 (нет пересечений по файлам).
