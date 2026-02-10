# WAF Rate Limits — настройка по трафику

Как подобрать оптимальные rate limits для papa-app на основе реального трафика.

---

## Текущие лимиты (Terraform)

| Endpoint | Limit | Window | Примечание |
|----------|-------|--------|------------|
| `/api/auth/*` | 100 | 5 min | Логин, callback, сессии |
| `/api/agent/search` | 200 | 5 min | Поиск |
| `/api/agent/export` | 30 | 5 min | Экспорт |
| `/api/compliance/audit-pack` | 30 | 5 min | Audit pack |
| `/api/files/upload` | 20 | 5 min | Загрузка файлов |
| `/api/*` (общий) | 2000 | 5 min | Предохранитель |

---

## Источники данных для тюнинга

### 1. WAF Logs (S3)

Включи логирование WAF → S3. Через 24–48 часов:

```
Top rules by blocks
→ Какие правила чаще всего блокируют
→ Есть ли легитимные блоки (false positives)
```

### 2. CloudWatch Metrics

- `AllowedRequestCount` — разрешённые запросы
- `BlockedRequestCount` — заблокированные
- По правилам: `rate-api-auth`, `rate-api-agent-search` и т.д.

### 3. ALB Access Logs

Если включены — смотри `request_url_path`, `client_ip`, `request_count`:

- P95/P99 запросов на IP за 5 мин
- Какие эндпоинты самые «тяжёлые»

### 4. Application logs

- Логин/логаут — частота на пользователя
- Поиск — типичная частота
- Экспорт — редкость операции

---

## Алгоритм подбора

### Шаг 1: Базовый профиль

| Тип эндпоинта | Рекомендация |
|---------------|--------------|
| Auth (логин, callback) | 50–150 / 5 min — 1 пользователь редко делает > 10 логинов за 5 мин |
| Search | 100–300 / 5 min — зависит от UI (автодополнение vs ручной поиск) |
| Export / Audit pack | 20–50 / 5 min — редкие операции |
| Upload | 10–30 / 5 min — зависит от размера файлов |
| Общий `/api/*` | 1000–3000 / 5 min — суммарный потолок |

### Шаг 2: Сбор метрик

1. Включи WAF logs на 48 часов
2. Собери P95/P99 по IP для каждого эндпоинта
3. Умножь на 1.5–2x для запаса

### Шаг 3: Корректировка

- **Много блоков** на легитимных пользователей → увеличить лимит
- **Мало блоков**, но виден abuse → уменьшить или оставить
- **Новые эндпоинты** → добавить правило в Terraform

---

## Пример: подбор для `/api/auth/*`

```
Данные за 7 дней:
- P95 запросов на IP за 5 мин: 12
- P99: 28
- Максимум (легитимный): 45 (тест с несколькими провайдерами)

Рекомендация: limit = 100 (запас 2x от max)
```

---

## Terraform: как менять

В `terraform/cloudfront-waf/main.tf`:

```hcl
rule {
  name     = "rate-api-auth"
  priority = 100
  action { block {} }
  statement {
    rate_based_statement {
      limit              = 150   # было 100
      aggregate_key_type = "IP"
      scope_down_statement { ... }
    }
  }
}
```

После изменения: `terraform plan` → `terraform apply`.

---

## SizeConstraint для upload (опционально)

**Важно:** WAF инспектирует body только до **64KB**. Если upload > 64KB — держать `upload_max_size_bytes = 0`.

WAF может блокировать по размеру тела. Для `/api/files/upload`:

```hcl
rule {
  name     = "size-api-files-upload"
  priority = 141
  action { block {} }
  statement {
    size_constraint_statement {
      comparison_operator = "GT"
      size                = 52428800  # 50 MB
      field_to_match { body {} }
      text_transformation { priority = 0; type = "NONE" }
    }
  }
}
```

Учитывай: WAF смотрит на тело запроса; для больших upload это может влиять на производительность.

---

## Чеклист тюнинга

- [ ] WAF logs включены (S3)
- [ ] 48 ч сбора данных
- [ ] P95/P99 по IP для ключевых эндпоинтов
- [ ] Лимиты обновлены в Terraform
- [ ] Алерт на рост BlockedRequestCount
- [ ] Документация обновлена (этот файл)

---

## См. также

- [CLOUDFRONT_WAF_ONEPAGER.md](./CLOUDFRONT_WAF_ONEPAGER.md)
- [RATE_LIMITS.md](./RATE_LIMITS.md) — app-level rate limits
