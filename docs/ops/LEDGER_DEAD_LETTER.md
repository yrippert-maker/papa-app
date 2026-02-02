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

Ручной процесс: прочитать строки, для каждой вызвать `POST /api/ledger/append` с `event_type` и `payload_json` (parsed). Удалить обработанные строки из файла.

## Retry

Ledger append использует `withRetry` с `maxAttempts: 5` и exponential backoff при SQLITE_BUSY.
