# Retention Policy

## Обзор

Политики хранения данных для compliance-контуров. Автоматическое удаление **не реализовано в коде** — retention применяется вручную или через cron.

---

## 1. Ledger Dead-Letter

**Файл:** `{WORKSPACE_ROOT}/00_SYSTEM/ledger-dead-letter.jsonl`

### Политика хранения
| Параметр | Значение | Обоснование |
|----------|----------|-------------|
| Retention | 90 дней | Достаточно для расследования инцидентов |
| Max size | 100 MB | После — ротация (manual/cron) |
| Archive | `dead-letter-archive/` | Хранить до подтверждённого replay |

### Правила удаления
1. **Только после подтверждённого replay**
   - `npm run replay:dead-letter` завершился с exit code 0
   - Все события успешно добавлены в ledger
2. **Фиксировать факт удаления**
   - Запись в ops log: дата, количество строк, оператор
3. **Архивы старше 90 дней**
   - `npm run cleanup:dead-letter -- --retention-days=90`

### Ротация по размеру
```bash
# Manual rotation при размере > 100MB
if [ $(stat -f%z ledger-dead-letter.jsonl 2>/dev/null || echo 0) -gt 104857600 ]; then
  npm run cleanup:dead-letter
fi
```

---

## 2. Evidence Keys

**Директория:** `{WORKSPACE_ROOT}/00_SYSTEM/keys/`

### Структура
```
keys/
├── active/
│   ├── evidence-signing.key   # приватный ключ
│   ├── evidence-signing.pub   # публичный ключ
│   └── key_id.txt             # идентификатор
└── archived/
    └── {key_id}/
        ├── evidence-signing.pub
        ├── archived_at.txt
        └── revoked.json       # если отозван
```

### Политика хранения
| Тип ключа | Retention | Обоснование |
|-----------|-----------|-------------|
| Active | 1 (текущий) | Только один активный ключ |
| Archived | 3 года минимум | Срок действия evidence |
| Revoked | Не удалять | Пока есть evidence с этим key_id |

### Правила удаления
1. **Архивные ключи**
   - Не удалять, пока могут существовать evidence bundles
   - Минимум 3 года после архивации
2. **Revoked ключи**
   - **Никогда не удалять** — нужны для верификации старых evidence
   - Хранить причину отзыва (`revoked.json`)
3. **Приватные ключи**
   - Только в `active/`
   - Не копировать в archive (security best practice)

---

## 3. Evidence Bundles (ZIP)

**Ответственность:** клиент

### Серверная сторона
- Сервер **не хранит** evidence bundles
- Генерируются on-demand через API
- Retention = 0 на сервере

### Клиентская сторона (рекомендация)
| Тип evidence | Retention | Обоснование |
|--------------|-----------|-------------|
| Inspection cards | 5 лет | Регуляторные требования |
| Audit exports | 7 лет | Бухгалтерский учёт |

---

## 4. Ledger Events (SQLite)

**Таблица:** `ledger_events`

### Политика
| Параметр | Значение |
|----------|----------|
| Retention | Бессрочно |
| Удаление | Запрещено |
| Архивация | Не применяется |

### Обоснование
- Ledger = immutable audit trail
- Удаление нарушает целостность цепочки (`prev_hash`)
- Регуляторное требование: полная история

---

## 5. Автоматизация

### Cron jobs (пример)
```bash
# /etc/cron.daily/papa-retention

# Dead-letter cleanup (90 дней)
cd /app && npm run cleanup:dead-letter -- --retention-days=90

# Log for audit
echo "$(date -Iseconds) retention-cleanup completed" >> /var/log/papa-ops.log
```

### Мониторинг
- Алерт на рост dead-letter: см. [ALERTS_COMPLIANCE.md](./ALERTS_COMPLIANCE.md)
- Метрика `ledger_dead_letter_events_total`

---

## См. также

- [RUNBOOK_LEDGER_DEAD_LETTER.md](./RUNBOOK_LEDGER_DEAD_LETTER.md)
- [EVIDENCE_SIGNING.md](./EVIDENCE_SIGNING.md)
- [LEDGER_DEAD_LETTER.md](./LEDGER_DEAD_LETTER.md)
