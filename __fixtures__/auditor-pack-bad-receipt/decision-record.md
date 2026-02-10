# Decision Record — fixture-bad-receipt — 2026-02-04

**Decision ID:** `796c9103-cca7-48bb-a2fd-9127f7bb4ed5` | **Fingerprint:** `5ceab249996c3970f069017b56027a927501bea0a486c518f5b8c878df1507cb` | **Ledger Entry ID:** `967374699a26f94b7529e36c9d1af3fb27b5d7e03210d08c4b0e07a0d3c1aa74` (immutability chain: decision_id → ledger_entry_id → anchor)

**Outcome:** FAIL

**Why:** RECEIPT_INTEGRITY_MISMATCH: 1 issue(s)

## Input

- Pack: `/Users/yrippertgmail.com/Desktop/papa-app/__fixtures__/auditor-pack-bad-receipt` (sha256: n/a)
- Policy: `/Users/yrippertgmail.com/Desktop/papa-app/docs/verify-policy.default.json`
- Fail severity: critical
- Fail types: RECEIPT_INTEGRITY_MISMATCH

## Checks

| Check | Outcome | Reason |
|-------|---------|--------|
| Pack manifest | pass | - |
| Hash chain | pass | - |
| Evidence index | pass | - |
| Anchoring status (STRICT) | pass | - |
| Anchoring issues (policy) | fail | Disallowed issues: RECEIPT_INTEGRITY_MISMATCH |
| Pack signature | skip | - |

## Rules that caused fail/warn

- **fail_type_or_severity:** RECEIPT_INTEGRITY_MISMATCH: 1 issue(s) [runbook](docs/runbook/anchoring-issues.md#receipt_integrity_mismatch)

## Approval

Auto-approved under policy: `/Users/yrippertgmail.com/Desktop/papa-app/docs/verify-policy.default.json`

## References

- [verify-summary.json](./verify-summary.json)
- [ledger-entry.json](./ledger-entry.json)