# Decision Diff

**From:** `565d385a-a421-43d5-b761-9e27bd5a8d77` (fingerprint: `f00030d367f47328…`)
**To:** `2f259f23-61d9-4f6a-bd9d-bc1eebdca86d` (fingerprint: `058ce11b097ccbf7…`)

**Summary:** Outcome: fail → fail. RECEIPT_INTEGRITY_MISMATCH: 1 issue(s); missing pack_hash.json or pack_signature.json

---

## Context diff

- **as_of:** `2024-06-01T00:00:00.000Z` → `n/a`
- **policy_version:** `v1` → `n/a`
- **policy_hash:** `7270d3ba3c92f135d2aaec97153476900e5cadbd7292820321e2815729eeab88` → `n/a`
- **pack_ref:** `fixture-minimal (./__fixtures__/auditor-pack-minimal)` → `fixture-bad-receipt (./__fixtures__/auditor-pack-bad-receipt)`

## Evidence diff

- **ledger_entry_id:** `5b1eb419f03169587a4ce5744da8974634c87d9c62ec26c06098fd365c9336a1` → `8345dd6be74bdbb0458ce273db533a5c0b82ff2ef77e6360029e38366ba7c2ee`

## Checks diff

**Outcome changed:**

| Check | From | To | Reason |
|-------|------|-----|--------|
| Anchoring issues (policy) | pass | fail | Disallowed issues: RECEIPT_INTEGRITY_MISMATCH |

## Rules diff

**Added (newly fired):**
- fail_type_or_severity: RECEIPT_INTEGRITY_MISMATCH: 1 issue(s)

## Why diff

**From:**
> missing pack_hash.json or pack_signature.json

**To:**
> RECEIPT_INTEGRITY_MISMATCH: 1 issue(s); missing pack_hash.json or pack_signature.json
