# Decision Diff

**From:** `a15a2a0b-45cb-4db2-8b35-f288cdd12219` (fingerprint: `c5516979b481b0ff…`)
**To:** `2f259f23-61d9-4f6a-bd9d-bc1eebdca86d` (fingerprint: `058ce11b097ccbf7…`)

**Summary:** Outcome: fail → fail. RECEIPT_INTEGRITY_MISMATCH: 1 issue(s); missing pack_hash.json or pack_signature.json

---

## Context diff

- **pack_ref:** `fixture-minimal (./__fixtures__/auditor-pack-minimal)` → `fixture-bad-receipt (./__fixtures__/auditor-pack-bad-receipt)`

## Evidence diff

- **ledger_entry_id:** `4f695e71d298ade806b016082799305308a9665cc0995c0fcd6277a0c5be2576` → `8345dd6be74bdbb0458ce273db533a5c0b82ff2ef77e6360029e38366ba7c2ee`

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
