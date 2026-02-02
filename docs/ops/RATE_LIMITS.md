# Rate Limits — Write Paths

## Обзор

Все write-endpoint'ы защищены in-memory rate limiter (60 req/min по умолчанию, кроме workspace/init и files/upload).

## Лимиты по endpoint

| Endpoint | Limit | Окно |
|----------|-------|------|
| POST /api/ledger/append | 60 | 1 min |
| POST /api/inspection/cards/:id/transition | 60 | 1 min |
| POST /api/inspection/cards/:id/check-results | 60 | 1 min |
| POST /api/admin/users | 60 | 1 min |
| PATCH /api/admin/users/:id | 60 | 1 min |
| POST /api/workspace/init | 10 | 1 min |
| POST /api/files/upload | 30 | 1 min |

## Ключ

Rate limit применяется по `x-forwarded-for` или `x-real-ip` (первый IP при прокси). При отсутствии — `unknown`.

## Ответ 429

- `{ error: { code: "RATE_LIMITED", message: "Too many requests", request_id: "..." } }`
- Header `Retry-After` (секунды до сброса окна)

## Multi-instance

In-memory store не разделяется между инстансами. Для production с несколькими репликами — Redis или аналог.
