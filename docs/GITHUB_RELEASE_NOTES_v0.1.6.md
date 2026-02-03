# Release v0.1.6 — Verify aggregator + UI single-call, test coverage

## Highlights

### Verify Aggregator

- **`GET /api/system/verify`**: Single endpoint combining AuthZ + Ledger verification
- Atomic snapshots with consistent timing
- Permission-aware: Ledger included only with `LEDGER.READ`, otherwise `{ skipped: true, reason: "..." }`
- Rate limit: 10 req/min
- Cache: `no-store` for evidence-grade consistency

### UI Improvements

- **Verify Center**: One "Verify" button, single loading/result state
- Handles 429 rate limit, 15s timeout, in-flight debouncing
- Correct display of `ledger_verification.skipped` as warning (not error)

### Security Fixes

- **TMC endpoints** (`/api/tmc/items`, `/api/tmc/lots`): Fixed permission from `TMC_MANAGE` → `TMC_VIEW`
- AUDITOR and read-only roles now have correct access to TMC data

### Infrastructure

- **Migration script**: Fixed DB re-open after `.mjs` migrations
- **Jest**: Added `--runInBand` and ignore patterns to resolve worker timeout issues

### Testing

- **Unit tests**: 9 new tests for aggregator contract, permissions, overall logic
- **E2E**: Added auditor scenario for `/api/system/verify`
- **Coverage**: 94 tests pass, 16 suites

## Documentation

- `docs/verify-aggregator.md` — API contract and UI migration notes
- `docs/UI_GUIDE.md` — Updated Verify page documentation
- `docs/ENDPOINT_AUTHZ_EVIDENCE.md` — Route count 15, new endpoint evidence

## Breaking Changes

None. Backward-compatible.

## Verification

```bash
npm test         # ✅ 94 tests pass
npm run build    # ✅ builds successfully
npm run e2e      # ✅ all scenarios pass
```

---

**Full release notes:** [RELEASE_NOTES_v0.1.6.md](docs/RELEASE_NOTES_v0.1.6.md)
