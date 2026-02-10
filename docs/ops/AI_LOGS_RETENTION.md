# Retention AI-логов (NFR-2.3, FR-2.6)

## Политика

Согласно `config/retention-policy.json`:

```json
"ai_logs": {
  "retention_years": 3,
  "note": "NFR-2.3"
}
```

AI-сессии и сообщения хранятся **3 года**. По истечении срока подлежат удалению.

## Таблицы

| Таблица | Описание | При удалении сессии |
|--------|----------|---------------------|
| agent_sessions | Сессии чата AI-агента | — |
| agent_messages | Сообщения (аудит диалога) | CASCADE |
| agent_generated_documents | Черновики и финальные документы | session_id → NULL |

При удалении старых `agent_sessions` связанные `agent_messages` удаляются автоматически (ON DELETE CASCADE). Документы `agent_generated_documents` сохраняются, `session_id` обнуляется.

## Скрипт автоочистки

```bash
# Dry-run (показать, что будет удалено)
npm run ai:logs:prune:dry

# Выполнить очистку
npm run ai:logs:prune

# Переопределить срок (лет)
node scripts/ai-logs-prune.mjs --years 5 --dry-run
```

## Cron (рекомендуется)

Добавить в crontab для еженедельного запуска:

```
0 3 * * 0 cd /path/to/papa-app && npm run ai:logs:prune
```

## См. также

- `config/retention-policy.json` — политика хранения
- `docs/ops/REGLAMENT_OBNOVLENIYA_INSTRUKCIJ.md` — регламент обновлений
- ТЗ-ПАПА-2026-001 v6.0 — NFR-2.3, FR-2.6
