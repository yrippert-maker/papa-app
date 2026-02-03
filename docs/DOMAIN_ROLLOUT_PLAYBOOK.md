# Domain Rollout Playbook — Audit-Ready Verification

Reusable checklist for applying the audit-ready verification contour to a new domain (payments, compliance exports, reporting, etc.).

---

## Step 1 — Snapshot

- [ ] Define `data.json` (domain snapshot)
- [ ] Define `artifacts/` (if external files exist)

---

## Step 2 — Integrity

- [ ] Implement `manifest.json` (id → sha256)
- [ ] Integrate `pack-hash.mjs` + `pack-sign.mjs`

---

## Step 3 — Issues

- [ ] Define enum `IssueType`
- [ ] Severity: `major | critical`
- [ ] Deterministic generation (no time/random)

---

## Step 4 — Verification

- [ ] Use `independent-verify.mjs` (or adapt)
- [ ] Configure env policy:
  - `STRICT_VERIFY`
  - `REQUIRE_<DOMAIN>_ISSUES`
  - `VERIFY_FAIL_SEVERITY`
  - `VERIFY_FAIL_TYPES`

---

## Step 5 — CI

- [ ] Add `verify_audit` job
- [ ] (Optional) Add `audit-monitor` scheduled workflow

---

## Example domains

- `payments-settlement`
- `financial-reports`
- `compliance-exports`
- `user-consent-ledger`

All use the same verify contour.
