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

   Verify checks `ANCHORING_ISSUES.json` and fails CI when disallowed issue types or critical severity are present (see env `VERIFY_FAIL_TYPES` / `VERIFY_FAIL_SEVERITY`).

3. **No critical errors**
   - [ ] No `RECEIPT_MISSING_FOR_CONFIRMED`
   - [ ] No `RECEIPT_INTEGRITY_MISMATCH` (critical)

4. **CI artefact** (if needed for auditors)
   - [ ] Verify output saved as CI artefact (`verify-output`) on main/tags

5. **Audit Monitor** (scheduled)
   - [ ] Workflow `audit-monitor` runs daily (06:15 UTC); failures can notify #channel if `SLACK_WEBHOOK_URL` is configured

---

## C3) Compliance / External Audit

- [AUDIT_ATTESTATION.md](AUDIT_ATTESTATION.md) — One-paragraph attestation (SOC/ISO ready)
- [SOX_MAPPING.md](SOX_MAPPING.md) — SOX 404 ITGC mapping
- [ISO27001_MAPPING.md](ISO27001_MAPPING.md) — ISO 27001 controls mapping
