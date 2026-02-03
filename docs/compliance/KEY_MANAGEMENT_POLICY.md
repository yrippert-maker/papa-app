# Key Management Policy — Pack Signing & Audit Trail

**Scope:** Keys used to sign auditor packs and (if applicable) anchor publishing.  
**Track:** Regulator / SOC2. Use when formal key management procedures are required.

---

## 1. In-scope keys

- **Pack signing key (Ed25519):** Signs `pack_hash.json`; used to attest integrity of the auditor pack. Stored or derived per section 2.
- **Anchor publisher key (EVM):** Used to publish Merkle roots (ledger rollup, app anchors) to the chain. Subject to same lifecycle and revoke as below; KMS/HSM use recommended where available.

## 2. Storage and access

- **Prefer:** Keys in **KMS** (e.g. AWS KMS, GCP KMS) or **HSM**; signing performed via API, private key never exported.
- **If software-held:** Stored in secrets manager (e.g. vault, CI secrets) with access limited to the signing job; no long-term storage on developer workstations.
- **Access:** Only designated roles (e.g. release/ops, anchor publisher) may trigger signing; access logged and reviewed per [ACCESS_REVIEW_CADENCE.md](./ACCESS_REVIEW_CADENCE.md).

## 3. Key lifecycle

- **Generation:** In KMS/HSM or in a secure, ephemeral environment; public key and key ID recorded and shared with verification side.
- **Rotation:** Planned rotation at least annually, or immediately on suspected compromise. New public key added to allow-list (`PACK_SIGN_PUBLIC_KEYS_PEM`); old key can remain valid for a grace period for already-signed packs.
- **Revocation:** On compromise or offboarding, key is revoked/disabled in KMS/HSM; removed from allow-list. Existing signatures remain verifiable with the old public key for historical packs; new packs must use a valid key.

## 4. Emergency revoke

- **Trigger:** Suspected or confirmed compromise of pack signing or anchor publisher key.
- **Steps:**
  1. Disable/revoke key in KMS/HSM (or invalidate in secrets manager).
  2. Remove key from verification allow-list so new verifies do not accept it.
  3. Notify Incident lead and Security; proceed per [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md).
  4. Generate and deploy new key; update CI/config to use new key for new packs/anchors.
  5. Document revoke and new key ID in change/incident log.
- **Audit impact:** Packs already signed with the revoked key remain valid for historical verification; no retroactive re-signing required unless policy dictates otherwise.

## 5. Allow-list for verification

- Verification (e.g. `independent-verify.mjs`) accepts multiple public keys via `PACK_SIGN_PUBLIC_KEYS_PEM` (concatenated PEMs) and optional `key_id` matching. This supports rotation without breaking verification of old packs.

## 6. Document control

- Version and approval: [To be set by your org]
- Next review: [Date]
- Owner: [Role/Team]
