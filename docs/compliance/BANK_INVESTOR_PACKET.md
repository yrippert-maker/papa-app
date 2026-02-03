# Bank / Investor Packet

This packet is designed for due diligence, procurement, and risk review.

## 1) What this program does
We run independent verification and produce tamper-evident evidence artifacts:
- verification results (signed packs)
- configuration/policy changes (append-only config ledger)
- mail ingestion and operator decisions (mail ledger)
- document updates from approved proposals (doc ledger)

## 2) Integrity guarantees
- Each artifact is hashed.
- Packs are signed and verified using an allowlisted public key set (rotation supported).
- Evidence is append-only, aggregated daily into Merkle rollups.
- Optional public anchoring provides an external timestamped proof.

## 3) Operational controls (SOC2-style)
- Access is least-privilege; write actions require explicit API keys/OIDC roles.
- All exceptions (acks) have TTL and are visible in an exception register.
- Automated jobs are monitored; failures raise structured alerts.

## 4) What you can verify in one day
- Verify a pack signature and reproduce independent verification results.
- Verify that the day's rollup includes the ledger entries for that day (manifest + Merkle root).
- Verify anchoring proof for the rollup (if enabled).
- Review exceptions and confirm time-bounded approvals.

## 5) References
- Public explainer: `docs/trust/PUBLIC_TRUST_EXPLAINER.md`
- Redacted samples: `docs/trust/REDACTED_SAMPLES.md`
- Due Diligence Answer Sheet: `docs/compliance/DUE_DILIGENCE_ANSWER_SHEET.md`
- SOC 2 Control Mapping: `docs/compliance/SOC2_CONTROL_MAPPING.md`
- Compliance overview: `docs/README_COMPLIANCE.md`
- Auditor checklist: `docs/AUDITOR_CHECKLIST_1DAY.md` (if present)
- Retention: `docs/AUDIT_PACK_RETENTION.md`
- Regulatory checklist: `docs/REGULATORY_SUBMISSION_CHECKLIST.md`

## 6) Suggested delivery
Provide:
1) Compliance ZIP (`npm run compliance:package` or regulatory bundle)
2) Read-only portal access (if available)
3) One anchored rollup example (if anchoring enabled)
