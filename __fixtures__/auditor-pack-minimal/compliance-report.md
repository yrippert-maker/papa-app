# Compliance Verification Report

**Report ID:** bf4fe555-2a3f-4524-8f37-f67b031b9913
**Generated:** 2026-02-04T08:17:08.434Z
**Decision ID:** `bf4fe555-2a3f-4524-8f37-f67b031b9913`
**Ledger Entry ID:** `fe225ad17b6b349321f5062687ee5d23b755a7339dbd72d20703592b952a4938`

> Immutability chain: decision_id → ledger_entry_id → anchor

## Outcome

**Result:** FAIL

**Explanation:** missing pack_hash.json or pack_signature.json

## Scope

- **Pack:** ./__fixtures__/auditor-pack-minimal (ID: fixture-minimal, SHA-256: n/a)
- **Policy:** /Users/yrippertgmail.com/Desktop/papa-app/docs/verify-policy.default.json
- **Verification date:** 2026-02-04T08:17:08.434Z

## Checks

| Check | Outcome | Reason |
|-------|---------|--------|
| Pack manifest | pass | - |
| Hash chain | pass | - |
| Evidence index | pass | - |
| Anchoring status (STRICT) | pass | - |
| Anchoring issues (policy) | pass | - |
| Pack signature | skip | - |

## Rules that caused fail/warn

- missing pack_hash.json or pack_signature.json

## Approval

- **Mode:** auto
- **Policy:** /Users/yrippertgmail.com/Desktop/papa-app/docs/verify-policy.default.json
- **Approver:** policy:/Users/yrippertgmail.com/Desktop/papa-app/docs/verify-policy.default.json
- **Approved at:** 2026-02-04T08:17:08.434Z

## Evidence references

- decision-record.json (Decision ID: `bf4fe555-2a3f-4524-8f37-f67b031b9913`)
- verify-summary.json
- ledger-entry.json (Ledger Entry ID: `fe225ad17b6b349321f5062687ee5d23b755a7339dbd72d20703592b952a4938`)
