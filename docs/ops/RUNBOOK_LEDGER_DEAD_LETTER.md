# Runbook: Ledger Dead-Letter

## Симптомы

- Alert `LedgerDeadLetterGrowth` сработал
- Метрика `papa_ledger_dead_letter_events_total` растёт
- Файл `00_SYSTEM/ledger-dead-letter.jsonl` содержит записи

---

## Диагностика

### 1. Проверить метрики

```bash
curl -s http://localhost:3000/api/metrics | grep dead_letter
```

Ожидаемый вывод:
```
papa_ledger_dead_letter_events_total 5
papa_ledger_dead_letter_replay_total{mode="live",result="ok"} 0
```

### 2. Проверить файл

```bash
# Количество записей
wc -l $WORKSPACE_ROOT/00_SYSTEM/ledger-dead-letter.jsonl

# Последние 5 записей
tail -5 $WORKSPACE_ROOT/00_SYSTEM/ledger-dead-letter.jsonl | jq .
```

### 3. Проверить типы ошибок

```bash
# Группировка по типу ошибки
cat $WORKSPACE_ROOT/00_SYSTEM/ledger-dead-letter.jsonl | jq -r '.error' | sort | uniq -c
```

Частые ошибки:
- `SQLITE_BUSY` — конкурентный доступ к DB
- `SQLITE_FULL` — диск заполнен
- `Connection refused` — DB недоступна

---

## Replay

### Dry-run (безопасно)

```bash
# Показывает, что будет реплеиться
npm run replay:dead-letter -- --dry-run
```

Проверить:
- Количество событий
- Типы событий
- Нет подозрительных payload

### Live replay

```bash
# Приложение должно работать
npm run replay:dead-letter
```

**Exit codes:**
- `0` — все события реплеились успешно
- `1` — часть событий не удалось реплеить (остались в файле)

### Проверка после replay

```bash
# Файл должен быть пустой или содержать только failed
wc -l $WORKSPACE_ROOT/00_SYSTEM/ledger-dead-letter.jsonl

# Проверить ledger integrity
curl http://localhost:3000/api/ledger/verify
```

---

## Когда НЕ делать replay

⚠️ **DO NOT replay если:**

1. **Событие дублирует существующее**
   - Проверить ledger на наличие аналогичного события
   - `cat dead-letter.jsonl | jq '.payload_json' | grep "inspection_card_id"`

2. **Ошибка в payload**
   - Невалидный JSON
   - Отсутствуют required fields
   - → Удалить строку вручную, задокументировать

3. **Тестовые данные**
   - `actor_id` содержит `test`, `dev`
   - → Удалить без replay

4. **Приложение всё ещё нестабильно**
   - DB недоступна
   - High error rate
   - → Сначала стабилизировать, потом replay

---

## Replay Failures

Если `npm run replay:dead-letter` вернул exit code 1:

### 1. Проверить логи

```bash
# Последний запуск
npm run replay:dead-letter 2>&1 | tee replay.log
grep -i "error\|fail" replay.log
```

### 2. Частые причины

| Причина | Решение |
|---------|---------|
| 401 Unauthorized | Проверить AUTH_EMAIL/AUTH_PASSWORD |
| 403 Forbidden | Admin не имеет LEDGER.APPEND |
| 400 Bad Request | Невалидный event_type или payload |
| 500 Internal Error | Проверить логи приложения |
| Connection refused | Приложение не запущено |

### 3. Ручной replay одного события

```bash
# Извлечь событие
head -1 $WORKSPACE_ROOT/00_SYSTEM/ledger-dead-letter.jsonl > single.json

# Попробовать вручную через API
curl -X POST http://localhost:3000/api/ledger/append \
  -H "Content-Type: application/json" \
  -d @single.json
```

---

## Post-mortem Checklist

После успешного replay:

- [ ] Файл dead-letter пустой или архивирован
- [ ] `npm run cleanup:dead-letter` для ротации
- [ ] Метрика `papa_ledger_dead_letter_events_total` стабилизирована
- [ ] Root cause задокументирован
- [ ] Incident ticket закрыт

---

## Архивация

```bash
# Ротировать текущий файл в архив
npm run cleanup:dead-letter

# С указанием retention
npm run cleanup:dead-letter -- --retention-days=90
```

---

## Эскалация

Если проблема не решается:

1. **L1 → L2:** Dead-letter растёт после replay
2. **L2 → Dev:** Неизвестный тип ошибки, требуется анализ кода
3. **Dev → On-call:** Ledger integrity нарушена

---

## См. также

- [LEDGER_DEAD_LETTER.md](./LEDGER_DEAD_LETTER.md) — техническое описание
- [ALERTS_COMPLIANCE.md](./ALERTS_COMPLIANCE.md) — алерты
- [RETENTION_POLICY.md](./RETENTION_POLICY.md) — политика хранения
