# BACKLOG — v0.1.3

## Goal

Strengthen regulatory evidence automation for AuthZ (RBAC) and post-release verification.
Introduce `AUTHZ_VERIFY_RESULT.txt` in the regulatory bundle, analogous to `LEDGER_VERIFY_RESULT.txt`.

## Scope (in)

### A) AUTHZ verification automation (primary)

1. **`scripts/verify-authz.mjs`**
   - Runs without server.
   - Validates:
     - Route registry integrity (unique method+path; permission present; permissions valid).
     - Role→permission mapping is valid (no unknown permissions).
     - Optional: mapping coverage vs documented endpoints (if docs are parsed, otherwise omit).
   - Produces canonical JSON output via `lib/canonical-json.mjs`.

2. **`lib/authz-verify-result.mjs`**
   - Schema v1 + invariant enforcement (executed/skipped/authz_ok/bundle_ok etc.).
   - Canonical JSON writer, deterministic output.

3. **Add `AUTHZ_VERIFY_RESULT.txt` to regulatory bundle**
   - Included in zip and MANIFEST (sha256).
   - Added to `docs/REGULATORY_BUNDLE_MANIFEST.md` (file count + normative semantics).

### B) Documentation updates (regulatory-grade)

1. **`docs/REGULATORY_BUNDLE_MANIFEST.md`**
   - Add normative block: `AUTHZ_VERIFY_RESULT.txt — Schema v1 (normative semantics)`
   - Clarify interpretation (bundle_ok vs authz_ok).

2. **`docs/REGULATOR_PACKAGE.md`**
   - Add link to `AUTHZ_VERIFY_RESULT.txt` and verification protocol step.

3. **`scripts/create-regulatory-bundle.sh` — BUNDLE_FINGERPRINT.md generation**
   - Add step: verify AuthZ evidence via `AUTHZ_VERIFY_RESULT.txt`.

### C) Optional hardening (if time permits)

- Rate-limit sensitive verification endpoints (e.g. `/api/ledger/verify`) to avoid DoS.
- Add CI step: `npm run bundle:regulatory` (if not already) to prevent bundle drift.

## Out of scope (explicit)

- New business endpoints or new write flows.
- AI behavior changes; autonomous actions; background agents.
- Major DB schema changes beyond AuthZ verification artifacts.

## Deliverables

- `dist/regulatory-bundle-v0.1.3.zip` includes:
  - `AUTHZ_VERIFY_RESULT.txt`
  - Updated MANIFEST and BUNDLE_FINGERPRINT references
- Tests:
  - Unit tests for `authz-verify-result` invariants
  - Script smoke test in CI (optional)

## Definition of Done (DoD)

- `AUTHZ_VERIFY_RESULT.txt` is generated automatically during bundle creation.
- Result is canonical JSON and includes schema_version.
- Result is listed in MANIFEST and its sha256 matches.
- `REGULATORY_BUNDLE_MANIFEST.md` includes normative semantics for the new file.
- Bundle builds are deterministic; tests and lint remain green.

## Proposed PR breakdown

- PR-1: Docs contract (AuthZ verify schema + manifest updates)
- PR-2: `lib/authz-verify-result.mjs` + canonical writer + unit tests
- PR-3: `scripts/verify-authz.mjs`
- PR-4: Bundle integration (`create-regulatory-bundle.sh` + file count updates)
- PR-5: Release v0.1.3 (notes, guide, tag)
