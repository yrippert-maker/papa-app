# Verify Aggregator — GET /api/system/verify

**Version:** v0.1.6  
**Purpose:** Single request returning AuthZ + Ledger snapshot; reduces N calls to 1.

## Contract

| Aspect | Value |
|--------|-------|
| **Endpoint** | `GET /api/system/verify` |
| **Permission** | WORKSPACE.READ |
| **Rate limit** | 10 req/min (shared with authz/ledger verify) |
| **Cache** | None (`Cache-Control: no-store`) |

## Response

- **200** — snapshot collected (success or partial — check `ok` field)
- **401** — not authenticated
- **403** — no WORKSPACE.READ
- **429** — rate limit
- **503** — upstream error (AuthZ or Ledger verification failed internally)

### Response body

```json
{
  "ok": true,
  "schema_version": 1,
  "generated_at": "2026-02-01T12:34:56Z",
  "authz_verification": {
    "authz_ok": true,
    "message": "AuthZ verification passed",
    "scope": { "route_count": 15, "permission_count": 10, ... }
  },
  "ledger_verification": {
    "ok": true,
    "message": "Ledger integrity: OK",
    "scope": { "event_count": 0, "id_min": null, "id_max": null }
  },
  "timing_ms": { "total": 12, "authz": 2, "ledger": 8 }
}
```

- `ledger_verification` — present only if user has LEDGER.READ. Otherwise `{ "skipped": true, "reason": "LEDGER.READ not granted" }`.
- `overall` — omitted; use `ok` (true only if authz_ok and ledger ok/skipped).

## Error Response (non-2xx)

All error responses (401, 403, 429, 503) use standardized format:

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests",
    "request_id": "835942d3-1c68-4fe9-aeaa-d46fdfc9c8be"
  }
}
```

### Error Codes

| HTTP | Code | Meaning |
|------|------|---------|
| 401 | `UNAUTHORIZED` | Not authenticated |
| 403 | `FORBIDDEN` | No WORKSPACE.READ permission |
| 429 | `RATE_LIMITED` | Rate limit exceeded (10 req/min) |
| 503 | `UPSTREAM_AUTHZ_ERROR` | AuthZ verification failed internally |
| 503 | `UPSTREAM_LEDGER_ERROR` | Ledger verification failed internally |

**Note:** `LEDGER.READ` missing is **not an error** — returns 200 with `ledger_verification.skipped`.

## UI migration ✅

The `/system/verify` page uses a single `GET /api/system/verify` (PR-2). No calls to `/api/authz/verify` or `/api/ledger/verify` from Verify Center. Same permissions: AuthZ always; Ledger only if LEDGER.READ; when skipped, UI shows "Ledger verification skipped" (warning, not error).

## Observability (v0.1.7)

- **Structured logs:** JSON to stdout (`verify_start`, `verify_end`), `request_id` for correlation
- **Metrics:** `GET /api/metrics` — Prometheus exposition format
- **Docs:** [docs/ops/verify-aggregator.md](ops/verify-aggregator.md) — metrics, logs, runbook

## Test coverage

### Backend unit (PR-3)

- `__tests__/api/system-verify.test.ts`: contract shape, permission branches, overall ok logic.
- Skip reason: constant `VERIFY_SKIP_REASONS.LEDGER_READ_NOT_GRANTED` (no string drift).

### E2E (PR-3)

- Auditor (WORKSPACE.READ + LEDGER.READ) → 200, ledger included.
- *Future:* role without LEDGER.READ → ledger skipped (when such role exists).
