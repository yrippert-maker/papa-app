# Auditor checklist — What to verify in 1 day

Use this list for a one-day audit of the evidence ledger and tamper-evidence pipeline.

## 1. Access and scope

- [ ] Obtain read access to the **Auditor Portal** (or direct read to ledger/rollup buckets).
- [ ] Confirm date range to audit (e.g. last 30 days).
- [ ] Note bucket/prefix for ledger (`ledger/`) and rollups (`ledger-rollups/`).

## 2. Ledger integrity

- [ ] For a sample day (e.g. yesterday UTC), open the **Days** view and confirm the day shows **ROLLED-UP**.
- [ ] Open **Day** for that date; note the **merkle_root_sha256** from the rollup.
- [ ] Download or view at least one **ledger entry** (e.g. via Presign or API). Confirm it contains:
  - `pack_sha256`, `signature` (ok/key_id), `anchoring`, `result`, `generated_at`.
- [ ] Optionally re-compute the leaf hash for that entry (e.g. from `fingerprint_sha256` or entry body) and confirm it matches the rollup manifest for that key.

## 3. Anchoring (tamper-evidence)

- [ ] For the same day, confirm the **ANCHORED** badge is present (or that `ROLLUP_ANCHORING_STATUS.json` exists).
- [ ] Open `ROLLUP_ANCHORING_STATUS.json` (via portal or API). Confirm:
  - `anchored: true`, `tx_hash` present, `network` (e.g. polygon).
- [ ] Optionally verify the transaction on-chain (block explorer) and confirm the Merkle root in the rollup matches the anchored value.

## 4. Pack reproducibility

- [ ] For one ledger entry, note `pack_sha256` and, if present, `pack_object.key`.
- [ ] If pack archives are used: download the pack (e.g. **Download pack** in the portal or from `packs/<sha>.tar.gz`). Confirm the archive hash or pack hash matches the ledger entry.
- [ ] Run independent verify on the unpacked pack (e.g. `node scripts/independent-verify.mjs --audit-pack <path>`) and confirm result matches the ledger entry `result`.

## 5. Exceptions and policy

- [ ] Open **Exception register** in the portal. Review acknowledged issues (fingerprint, ack_by, expires_at).
- [ ] Confirm that expired acks are either excluded (active only) or clearly marked.
- [ ] Optionally review verify policy (e.g. `verify-policy.json` or pack policy) and confirm fail/warn rules are documented.

## 6. Retention and operations

- [ ] Confirm retention policy for ledger and rollups (e.g. ≥ 180 days; see AUDIT_PACK_RETENTION.md).
- [ ] If applicable, confirm bucket versioning or object lock is enabled for the ledger bucket.

## Sign-off

| Item | Done | Notes |
|------|------|-------|
| Ledger entries accessible | ☐ | |
| Rollup present for sample day | ☐ | |
| Anchoring status verified | ☐ | |
| Pack reproducibility checked | ☐ | |
| Exception register reviewed | ☐ | |

**Auditor:** _________________ **Date:** _________________
