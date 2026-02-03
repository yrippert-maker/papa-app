# Release Notes v0.1.6

**Release Date:** 2026-02-02  
**Tag:** `v0.1.6`  
**Status:** Production-ready

---

## Summary

v0.1.6 introduces the **Verify Aggregator** — a unified API endpoint that combines AuthZ and Ledger verification results in a single, atomic request. This reduces N+1 API calls, provides consistent snapshots, and improves UX by consolidating loading states and error handling in the Verify Center UI.

Additionally, this release includes critical permission fixes for TMC endpoints, infrastructure improvements for migration stability, and comprehensive test coverage (unit + E2E).

---

## 1. New Features

### 1.1 Verify Aggregator API

**Endpoint:** `GET /api/system/verify`

**Purpose:** Single-call verification combining AuthZ and Ledger checks for consistent, atomic snapshots.

**Permission:** `WORKSPACE.READ` (required for access)

**Response structure:**

```json
{
  "ok": true,
  "schema_version": 1,
  "generated_at": "2026-02-02T10:33:00Z",
  "authz_verification": {
    "authz_ok": true,
    "message": "AuthZ verification passed",
    "scope": { "route_count": 15, ... }
  },
  "ledger_verification": {
    "ok": true,
    "message": "Ledger integrity: OK",
    "scope": { "event_count": 0, "id_min": null, "id_max": null }
  },
  "timing_ms": { "total": 5, "authz": 2, "ledger": 3 }
}
```

**Ledger handling:**

- **With `LEDGER.READ`:** Ledger verification results included
- **Without `LEDGER.READ`:** `ledger_verification: { skipped: true, reason: "LEDGER.READ not granted" }`
- Skip reason is now a **constant** (`VERIFY_SKIP_REASONS.LEDGER_READ_NOT_GRANTED`) to prevent string drift

**Rate limiting:** 10 requests/min per client  
**Cache policy:** `Cache-Control: no-store` (evidence-grade consistency)

### 1.2 Verify Center UI Migration

**Before:** Two separate API calls (`/api/authz/verify`, `/api/ledger/verify`), separate loading/error states

**After:** Single `GET /api/system/verify` call with:

- Unified "Verify" button
- Single loading state with `AbortController` (15s timeout)
- Consolidated result display (AuthZ + Ledger sections)
- Correct handling of `ledger_verification.skipped` as warning (not error)
- 429 rate limit handling with "Try again later" UI
- In-flight request debouncing

---

## 2. Security & Permission Fixes

### 2.1 TMC Endpoints: Permission Alignment

**Affected routes:**

- `GET /api/tmc/items`
- `GET /api/tmc/lots`

**Change:** `requirePermission(TMC_MANAGE)` → `requirePermission(TMC_VIEW)`

**Rationale:** Read-only endpoints must not require write permissions. This fix aligns with the permission model introduced in migration 003 and enables AUDITOR role to access TMC data.

**Impact:** AUDITOR, ENGINEER, STOREKEEPER, MANAGER now have correct read access to TMC items/lots.

---

## 3. Infrastructure & Stability

### 3.1 Migration Script Fix

**File:** `scripts/migrate.mjs`

**Issue:** After running a `.mjs` migration (which closes the DB connection), the script failed to re-open the DB for subsequent `.sql` migrations, causing "The database connection is not open" errors.

**Fix:** Re-open `db` after processing `.mjs` migration (changed `const db` to `let db` for reassignment).

**Affected flow:** Migrations 002 (.mjs) → 003 (.sql)

### 3.2 Jest Configuration

**Issue:** Jest worker parallelization caused ETIMEDOUT errors on file system operations (likely due to large ignored directories).

**Fix:**

- `package.json`: `npm test` now uses `--runInBand` (serial execution)
- `jest.config.ts`: Added `watchPathIgnorePatterns` for "Новая папка" and "Новая папка с объектами"

**Impact:** Tests now run reliably without worker timeout issues.

---

## 4. Testing & Evidence

### 4.1 Unit Tests

**New file:** `__tests__/api/system-verify.test.ts` (9 tests)

- Contract shape validation (authz_verification, ledger_verification, timing_ms)
- Permission branches (with/without LEDGER.READ)
- Overall `ok` logic (authz + ledger combined states)
- Constant skip reason validation

### 4.2 E2E Tests

**Updated:** `scripts/e2e-smoke.mjs`

- Added test for auditor calling `/api/system/verify`
- Verifies: 200 response, AuthZ + Ledger included (not skipped), aggregator contract

**Result:** ✅ All E2E tests pass

### 4.3 Test Coverage Summary

| Test Suite | Count | Status |
|------------|-------|--------|
| Unit tests | 94 tests, 16 suites | ✅ PASS |
| E2E smoke | 12 scenarios | ✅ PASS |

---

## 5. Documentation

### 5.1 New Documentation

- `docs/verify-aggregator.md` — API contract, response format, UI migration notes
- `docs/BACKLOG_v0.1.6.md` — v0.1.6 PR plan and DoD

### 5.2 Updated Documentation

- `docs/UI_GUIDE.md` — Verify page now uses aggregator, updated API response format
- `docs/ENDPOINT_AUTHZ_EVIDENCE.md` — Route count updated to 15, added `/api/system/verify`

---

## 6. Breaking Changes

**None.** This release is backward-compatible. Standalone endpoints (`/api/authz/verify`, `/api/ledger/verify`) remain available and unchanged.

---

## 7. Migration Notes

### From v0.1.5 → v0.1.6

**No action required.** All changes are internal:

- UI automatically uses new aggregator endpoint
- TMC permission fixes are transparent to users with correct roles
- Jest/migration fixes are dev-only

---

## 8. Known Limitations

### 8.1 E2E Coverage Gap

**Current:** E2E tests auditor (has LEDGER.READ), verifies ledger included.

**Missing:** E2E scenario for user *without* LEDGER.READ → ledger skipped.

**Reason:** All current roles (ADMIN, AUDITOR, MANAGER, STOREKEEPER, ENGINEER) have `LEDGER.READ`.

**Mitigation:** Unit tests cover the skipped path. Future: add E2E when a role without LEDGER.READ is introduced.

---

## 9. Verification Steps (Post-Release)

1. **Local sanity check:**

   ```bash
   npm test         # 94 tests pass
   npm run build    # builds successfully
   npm run e2e      # all E2E scenarios pass
   ```

2. **Verify tag:**

   ```bash
   git show v0.1.6 --no-patch
   ```

3. **GitHub Release:**

   - Tag: `v0.1.6`
   - Title: `Release v0.1.6 — Verify aggregator + UI single-call, test coverage`
   - Body: This file or summary
   - Status: Latest release

4. **Regulatory bundle (optional):**

   ```bash
   bash scripts/create-regulatory-bundle.sh v0.1.6
   ```

   Bundle fingerprint: (to be added post-release)

---

## 10. Contributors

- **Development:** AI Assistant (Cursor)
- **Review:** User (yrippertgmail.com)

---

## 11. Release Artifact

**Bundle:** `dist/regulatory-bundle-v0.1.6.zip`  
**SHA-256:** `dc9a5025c97ef4cffc15981ea43a779eef30ecfd9b89c0c3880aeed9374a8809`

---

**Release approved by:** (manual sign-off)  
**Deployment date:** (to be filled on production deployment)
