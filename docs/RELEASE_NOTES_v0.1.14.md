# Release Notes v0.1.14 — Operational hardening

## Summary

Rate limits на write-path, ledger retries + dead-letter.

## Changes

- **Rate limits**: 429 RATE_LIMITED с Retry-After; 60 req/min (ledger, inspection, admin), 30 (upload), 10 (workspace init)
- **Ledger retries**: maxAttempts 5 для append, transition, check-results
- **Dead-letter**: `{WORKSPACE_ROOT}/00_SYSTEM/ledger-dead-letter.jsonl` — JSONL, replay описан в docs
- **Docs**: ops/RATE_LIMITS.md, ops/LEDGER_DEAD_LETTER.md
- **Tests**: 170 passed, rateLimitError unit test

## Runtime fingerprint

- Node.js: см. `package.json` engines
- npm: `npm ci` для воспроизводимой сборки
