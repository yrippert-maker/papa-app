# Rate Limits

## Обзор

Rate limits защищают API от abuse и обеспечивают справедливое распределение ресурсов.

---

## Endpoints с Rate Limits

| Endpoint | Limit | Window | Per |
|----------|-------|--------|-----|
| `POST /api/ledger/append` | 10 req | 1 min | IP |
| `POST /api/inspection/cards/:id/transition` | 10 req | 1 min | IP |
| `POST /api/inspection/cards/:id/check-results` | 10 req | 1 min | IP |
| `POST /api/inspection/evidence/verify` | 20 req | 1 min | IP |

---

## Payload Size Limits

| Endpoint | Max Size |
|----------|----------|
| `POST /api/inspection/evidence/verify` | 5 MB |
| `POST /api/files/upload` | 50 MB |

---

## Response при превышении

### Rate Limit (429)

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests",
    "request_id": "..."
  }
}
```

Headers:
```
Retry-After: 45
```

### Payload Too Large (400)

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Payload too large (max 5 MB)",
    "request_id": "..."
  }
}
```

---

## Реализация

### In-memory store

```typescript
// lib/rate-limit.ts
const store = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, opts: { windowMs?: number; max?: number })
```

### Client identification

```typescript
// По IP (X-Forwarded-For или X-Real-IP)
export function getClientKey(req: Request): string
```

---

## Ограничения текущей реализации

1. **In-memory store**
   - Сбрасывается при рестарте
   - Не работает для multi-instance deployments

2. **Решение для production**
   - Redis-based rate limiter
   - Или rate limiting на уровне ingress/WAF

---

## Мониторинг

### Метрики

```
papa_evidence_verify_total{result="rate_limited"}
```

### Алерты

```yaml
- alert: RateLimitTriggered
  expr: increase(papa_evidence_verify_total{result="rate_limited"}[5m]) > 10
  labels:
    severity: info
```

---

## Изменение лимитов

### Через код

```typescript
// В route.ts
const rateCheck = checkRateLimit(`key:${clientKey}`, { max: 30, windowMs: 60_000 });
```

### Рекомендации

| Сценарий | Рекомендация |
|----------|--------------|
| High legitimate traffic | Увеличить `max` |
| Abuse detected | Уменьшить `max` или добавить ban |
| Batch operations | Выделенный endpoint без лимита |

---

## См. также

- [ALERTS_COMPLIANCE.md](./ALERTS_COMPLIANCE.md)
- [RUNBOOK_EVIDENCE_VERIFY.md](./RUNBOOK_EVIDENCE_VERIFY.md)
