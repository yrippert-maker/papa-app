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

- **200** — snapshot collected
- **403** — no WORKSPACE.READ
- **429** — rate limit

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

## UI migration ✅

The `/system/verify` page uses a single `GET /api/system/verify` (PR-2). No calls to `/api/authz/verify` or `/api/ledger/verify` from Verify Center. Same permissions: AuthZ always; Ledger only if LEDGER.READ; when skipped, UI shows "Ledger verification skipped" (warning, not error).

## Test coverage

### Backend unit (PR-3)

- `__tests__/api/system-verify.test.ts`: contract shape, permission branches, overall ok logic.
- Skip reason: constant `VERIFY_SKIP_REASONS.LEDGER_READ_NOT_GRANTED` (no string drift).

### E2E (PR-3)

- Auditor (WORKSPACE.READ + LEDGER.READ) → 200, ledger included.
- *Future:* role without LEDGER.READ → ledger skipped (when such role exists).
