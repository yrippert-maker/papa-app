# Ops / Audit Checklist — Anchoring & Copy UX

## C1) Ops Smoke Test (~5 min)

1. Open `/governance/anchoring`
2. Click **View issues (30d)**
3. Check:
   - [ ] **Reload** works
   - [ ] **Critical only**, **Hide gaps**, **Search** work
4. Check copy:
   - [ ] tx → ✓ and highlight
   - [ ] anchor → ✓ and highlight
   - [ ] link → ✓
   - [ ] (Optional) Break clipboard (browser settings) → ⚠︎ + rose highlight

---

## C2) Audit Readiness (~15 min)

1. **Receipts in storage**
   - [ ] `00_SYSTEM/anchor-receipts/<tx_hash>.json` present
   - [ ] `00_SYSTEM/anchor-receipts/receipts_manifest.json` present

2. **Strict verify**
   ```bash
   STRICT_VERIFY=1 node scripts/independent-verify.mjs --audit-pack <path-to-pack>
   ```
   - [ ] Exit code 0

3. **No critical errors**
   - [ ] No `RECEIPT_MISSING_FOR_CONFIRMED`
   - [ ] No `RECEIPT_INTEGRITY_MISMATCH` (critical)

4. **CI artefact** (if needed for auditors)
   - [ ] Verify output saved as CI artefact (`verify-output`) on main/tags
