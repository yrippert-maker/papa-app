## v0.1.5 — Ledger Verify UI, evidence-grade API, cover letters

### Ledger Verify UI

- `/system/verify` — Ledger section: button "Verify ledger", call `GET /api/ledger/verify`
- Permission: LEDGER.READ (section gated)
- StatePanel: OK / Failed / Skipped (403) / Rate limit
- Details: event_count, id_min, id_max, timing_ms

### API `/api/ledger/verify`

- scope: event_count, id_min, id_max
- timing_ms: total
- Cache-Control: no-store
- Rate limit: 10 req/min, 429 + Retry-After

### Regulatory

- Cover letters RU/EN: placeholders `[RELEASE_TAG]`, `[COMMIT_SHA]`, `[ZIP_SHA256]`, `[SHA256_MANIFEST]`
- Verification protocol: see REGULATORY_SUBMISSION_CHECKLIST.md

### Verify Center

- AuthZ + Ledger on one page
- No false green: skipped/403 → warning, never OK
