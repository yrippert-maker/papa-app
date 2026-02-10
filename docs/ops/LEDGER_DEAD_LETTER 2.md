# Ledger Dead-Letter

## Назначение

При сбое записи в `ledger_events` (после 5 попыток retry при SQLITE_BUSY) событие сохраняется в dead-letter для ручного replay.

## Расположение

`{WORKSPACE_ROOT}/00_SYSTEM/ledger-dead-letter.jsonl`

Каждая строка — JSON:
```json
{"event_type":"FILE_REGISTERED","payload_json":"{...}","actor_id":"1","error":"SQLITE_BUSY","ts_utc":"2026-02-01T12:00:00.000Z"}
```

## Replay

Скрипт `scripts/replay-ledger-dead-letter.mjs` читает dead-letter, вызывает `POST /api/ledger/append` для каждой строки и удаляет успешно обработанные.

```bash
# Приложение должно быть запущено (npm run dev или npm run start)
WORKSPACE_ROOT=/path/to/workspace npm run replay:dead-letter

# Только показать, что будет переиграно (без запросов)
npm run replay:dead-letter -- --dry-run

# Указать URL приложения
npm run replay:dead-letter -- --base-url=http://localhost:3000
```

Переменные окружения:
- `WORKSPACE_ROOT` — корень workspace (по умолчанию `./data`)
- `AUTH_EMAIL`, `AUTH_PASSWORD` — учётные данные admin (по умолчанию `admin@local` / `admin`)
- `E2E_BASE_URL` — URL приложения, если не передан `--base-url=`

Код выхода: 0 — все события переиграны; 1 — часть не удалась (оставшиеся строки остаются в файле).

## Retry

Ledger append использует `withRetry` с `maxAttempts: 5` и exponential backoff при SQLITE_BUSY.

## Retention и Cleanup

Скрипт `scripts/cleanup-dead-letter.mjs`:
- Ротирует текущий файл → архив с timestamp
- Удаляет архивы старше N дней (default: 30)
- Выводит JSON для интеграции с alerting

```bash
# Dry-run (без записи)
npm run cleanup:dead-letter -- --dry-run

# Реальная очистка с retention 14 дней
npm run cleanup:dead-letter -- --retention-days=14
```

### Структура архива
```
00_SYSTEM/
├── ledger-dead-letter.jsonl          # текущий файл
└── dead-letter-archive/
    ├── dead-letter-2026-02-01T12-00-00-000Z.jsonl
    └── dead-letter-2026-01-15T08-30-00-000Z.jsonl
```

### Алерты

Скрипт выводит JSON с полями для alerting:
```json
{
  "alert_high_volume": true,      // >100 entries
  "alert_growing": true,          // >50 entries + >5 archives
  "before": {...},
  "after": {...}
}
```

Интеграция с cron + alertmanager:
```bash
# /etc/cron.daily/papa-dead-letter-cleanup
cd /app && npm run cleanup:dead-letter 2>&1 | grep alert-data | logger -t papa-dead-letter
```
