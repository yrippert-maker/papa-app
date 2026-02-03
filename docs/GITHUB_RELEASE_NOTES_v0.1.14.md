# Release v0.1.14 — Operational hardening (rate limits & ledger reliability)

## Overview
v0.1.14 усиливает операционную надёжность системы:
добавляет rate limits на write-path и механизм retries + dead-letter
для ledger append операций.

---

## Key Changes

### Rate limits
- Стандартизированный `429 RATE_LIMITED` с `Retry-After`.
- Лимиты по endpoint:
  - 60 req/min:
    - `POST /api/ledger/append`
    - `POST /api/inspection/cards/:id/transition`
    - `POST /api/inspection/cards/:id/check-results`
    - `POST /api/admin/users`
    - `PATCH /api/admin/users/:id`
  - 30 req/min:
    - `POST /api/files/upload`
  - 10 req/min:
    - `POST /api/workspace/init`

### Ledger reliability
- Retries для ledger append операций (`maxAttempts: 5`).
- Dead-letter storage:
  - `{WORKSPACE_ROOT}/00_SYSTEM/ledger-dead-letter.jsonl`
  - JSONL format (one event per line).
- Dead-letter payload включает:
  - `event_type`, `payload_json`, `actor_id`, `error`, `ts_utc`.
- Dead-letter replay:
  - `lib/dead-letter-replay.mjs` — safe parsing JSONL + normalization of `payload_json`
  - `scripts/replay-ledger-dead-letter.mjs` — replay tool updated to use shared parser
  - `--dry-run` — preview events without writing to ledger

### Documentation
- `docs/ops/RATE_LIMITS.md`
- `docs/ops/LEDGER_DEAD_LETTER.md` (dead-letter + replay)

---

## Tests
- Unit tests для `rateLimitError`, dead-letter replay parser, `appendToDeadLetter`.
- Total: **181 tests passed**
- Build: ✅

---

## Release Artifacts
- `dist/regulatory-bundle-v0.1.14.zip`
- SHA-256: **e9f5c28b8fba51033fe6af70bde95f6a850b63881741a64103d5f92bcb6fffc2**
