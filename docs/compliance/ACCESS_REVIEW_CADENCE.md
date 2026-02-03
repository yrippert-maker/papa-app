# Access Review Cadence — Evidence Ledger & Audit Trail

**Scope:** Who has access to ledger storage, rollup pipeline, anchoring, pack signing, and auditor-facing services.  
**Track:** Regulator / SOC2. Use when formal access review procedures are required.

---

## 1. In-scope assets

| Asset | Description | Access types |
|-------|-------------|--------------|
| Ledger bucket (S3/GCS) | Append-only ledger entries | Read (auditors/portal); Write (CI/publish job only) |
| Rollup prefix | Daily rollups + ROLLUP_ANCHORING_STATUS | Read (auditors/portal); Write (rollup job only) |
| Packs bucket | Pack archives (tar.gz) | Read (auditors/portal); Write (ledger-publish/CI) |
| Pack signing key | KMS/HSM or secrets manager | Use (sign only): release/CI role |
| Anchor publisher key | Chain publish | Use: anchor job / designated service account |
| Auditor Portal API | Read-only gateway to ledger/rollups | API key or OIDC; read-only |
| Issue-ack server | Exception register (acks) | Read/Write per API; API key if required |

## 2. Principles

- **Least privilege:** Only roles that need to write (CI, rollup job, anchor job) have write access; auditors and portal have read-only.
- **Separation:** Signing and anchor publish should use dedicated identities (service accounts, CI roles), not personal accounts.
- **Auditability:** Access to buckets and key usage should be logged (e.g. cloud audit logs, CI logs).

## 3. Review cadence

- **Quarterly:** List of identities with write access to ledger bucket, rollup prefix, packs bucket; list of identities that can trigger pack signing or anchor publish. Confirm each is still required; remove or rotate if not.
- **Quarterly:** List of identities with read access to Auditor Portal API (or direct read to buckets if used). Confirm appropriate for auditors/ops only.
- **On change:** When adding/removing access or rotating keys, document in change log; next quarterly review confirms it.

## 4. Review checklist

- [ ] Ledger bucket: write access limited to [CI role / publish job]; read access documented.
- [ ] Rollup prefix: write access limited to rollup job (+ anchor job if it writes ROLLUP_ANCHORING_STATUS); read access documented.
- [ ] Packs bucket: write access limited to ledger-publish/CI; read access documented.
- [ ] Pack signing: only [role/service] can invoke; no export of private key.
- [ ] Anchor publisher: only [role/service] can publish; key in KMS/HSM or equivalent.
- [ ] Portal API: consumers listed; API keys or OIDC scope reviewed.
- [ ] Issue-ack server: write access (POST /ack) restricted; read (GET) appropriate for portal/auditors.

## 5. Document control

- Version and approval: [To be set by your org]
- Next review: [Date]
- Owner: [Role/Team]
