# Anchoring Governance — Control Description

*(ISO / SOC / Internal Compliance Version)*

## Control Objective

Ensure integrity, completeness, and auditability of anchoring operations and associated on-chain receipts.

## Control Design

* Anchoring data is periodically snapshotted into an immutable auditor pack.
* Each confirmed anchor must have:
  * an associated receipt,
  * a matching SHA-256 hash in a signed manifest.
* Anchoring issues are classified by type and severity.

## Control Operation

* Independent verification is executed offline using the auditor pack.
* Verification evaluates:
  * receipt existence,
  * hash integrity,
  * anchoring lifecycle consistency,
  * temporal gaps.
* Verification runs automatically in CI for `main` and release tags.

## Control Enforcement

* CI pipeline blocks releases if:
  * required audit artifacts are missing,
  * critical issues are detected,
  * explicitly disallowed issue types are present.

## Evidence

* Auditor pack contents
* Verification logs (`verify-output`)
* Machine-readable summary (`verify-summary.json`)
* CI job execution records
* Operational checklist (`OPS_AUDIT_CHECKLIST_ANCHORING.md`)

## Residual Risk

* Live blockchain state is not verified (offline design).
* Risk accepted and documented.
