# Release Notes — v0.1.5

## Highlights

- **Ledger Verify UI** (`/system/verify`): section "Ledger integrity" with button "Verify ledger"; calls `GET /api/ledger/verify`; displays OK / Failed / Skipped / Rate limit via StatePanel.
- **API `/api/ledger/verify` evidence-grade**: `scope` (event_count, id_min, id_max), `timing_ms`, `Cache-Control: no-store` — aligned with AuthZ verify.
- **Regulatory cover letters**: `REGULATORY_COVER_LETTER_RU.md`, `REGULATORY_COVER_LETTER_EN.md` (placeholders: `[RELEASE_TAG]`, `[COMMIT_SHA]`, `[ZIP_SHA256]`, `[SHA256_MANIFEST]`).
- **Verify Center**: AuthZ + Ledger sections on one page; Ledger section gated by `LEDGER.READ`.

## Security / Safety

- Ledger verify: permission `LEDGER.READ`; rate limit 10 req/min; 429 with Retry-After.
- Skipped semantics: 403 → "Доступ запрещён"; UI never shows OK for skipped/denied.

## Evidence and Traceability

- Runtime API response: `ok`, `message`, `scope`, `timing_ms`; Cache-Control: no-store.
- Bundle LEDGER_VERIFY_RESULT (offline) unchanged; independent of runtime endpoint.
- UI_GUIDE: Ledger section permissions, API response format.

## Breaking Changes

- None.

## How to Verify

```bash
npm test
npm run lint
npm run build
npm run migrate
npm run bundle:regulatory
```

## Release Artifact

- **Release tag:** v0.1.5
- **Release commit (git SHA):** d0af274
- **Submission bundle:** `dist/regulatory-bundle-v0.1.5.zip`
- **SHA-256:** `5401cc1b52137ae86597e9bf5a892cf8176bea9e7a0886a619b48231306e0d88`
