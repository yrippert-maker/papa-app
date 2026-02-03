# Compliance package — Evidence ledger & audit trail

This document describes the **compliance-ready** evidence pipeline: append-only ledger, daily Merkle rollups, on-chain anchoring, and auditor-facing artifacts. Use it for enterprise due diligence, regulatory questions, SOC-style discussions, and bank/payment audits.

## Overview

- **Evidence:** Each verification run produces a **ledger entry** (pack hash, signature, anchoring status, policy, result). Entries are published to object storage (S3/GCS) under `ledger/YYYY/MM/DD/<pack_sha256>.json`.
- **Pack archives:** Optional pack `tar.gz` are stored in a separate bucket; ledger entries reference them via `pack_object` for full reproducibility.
- **Daily rollups:** A **Merkle tree** is built over all ledger entries per UTC day. Rollups include both `ledger/YYYY/MM/DD/*.json` (verify/mail-ledger) and `doc-ledger/YYYY/MM/DD/*.json` (doc updates, config_change e.g. allowlist). Rollups are stored under `ledger-rollups/YYYY/MM/DD/rollup.json` and `manifest.json`.
- **Anchoring:** The daily Merkle root can be **anchored** (published to a public chain). Status is stored in `ledger-rollups/YYYY/MM/DD/ROLLUP_ANCHORING_STATUS.json`. This makes the ledger **tamper-evident** and independently verifiable.
- **Exception register:** Acknowledged issues (exceptions) are tracked in the ack service and visible in the Auditor Portal under **Exception register**. Expired acks are treated as unacked (TTL enforcement).

## Artifacts for auditors

| Artifact | Location / how to obtain | Purpose |
|----------|--------------------------|--------|
| Ledger entries | `ledger/YYYY/MM/DD/*.json` or via Auditor Portal | Proof of what was verified and when |
| Doc/config ledger | `doc-ledger/YYYY/MM/DD/*.json` (doc_update, config_change) | Document and allowlist change audit trail; included in daily rollup Merkle root. Config changes are committed only after an immutable ledger entry is durably written (prepare → commit; `_pending/` is internal). |
| Pack archive | `packs/<pack_sha256>.tar.gz` or “Download pack” in portal | Exact pack used for verification |
| Daily rollup | `ledger-rollups/YYYY/MM/DD/rollup.json` | Merkle root for the day |
| Rollup manifest | `ledger-rollups/YYYY/MM/DD/manifest.json` | List of entries in the rollup |
| Anchor proof | `ledger-rollups/YYYY/MM/DD/ROLLUP_ANCHORING_STATUS.json` | On-chain anchor (tx_hash, network) |
| Verify summary | Inside pack: `verify-summary.json` | Machine-readable verify result |
| Policy | Pack or repo: `verify-policy.json` | Fail/warn rules |

## How to use this in practice

| Audience | Suggested materials |
|----------|----------------------|
| **Investor / bank** | [Due Diligence Answer Sheet](./compliance/DUE_DILIGENCE_ANSWER_SHEET.md) + [Public Trust Explainer](./trust/PUBLIC_TRUST_EXPLAINER.md) |
| **Enterprise / security review** | Answer Sheet + [SOC 2 Control Mapping](./compliance/SOC2_CONTROL_MAPPING.md) |
| **Auditor** | Compliance ZIP + [AUDITOR_CHECKLIST_1DAY.md](./AUDITOR_CHECKLIST_1DAY.md) + Portal (read-only) |

This set supports **due diligence**, **enterprise procurement**, **internal/external audit**, and **board-level review**.

## Auditor checklist (1 day)

See **[AUDITOR_CHECKLIST_1DAY.md](./AUDITOR_CHECKLIST_1DAY.md)** for a concise “what to verify in one day” checklist.

## Release baseline (audit-grade)

- **v1.0.0** — Audit-grade baseline: strict config ledger, unified rollup, mail governance. См. [AUDIT_GRADE_STATUS.md](./AUDIT_GRADE_STATUS.md). Regulatory bundle: `regulatory-bundle-v1.0.0.zip` (см. [REGULATORY_SUBMISSION_CHECKLIST.md](./REGULATORY_SUBMISSION_CHECKLIST.md)).

## External Trust Package (versioned)

The compliance ZIP is published as **External Trust Package**. Any change to its contents requires a **new version** (do not overwrite a released package).

- **Current frozen version:** `compliance-v1`
- **Filename:** `External-Trust-Package-compliance-v1.zip`
- **Rule:** See [compliance/COMPLIANCE_PACKAGE_VERSIONING.md](./compliance/COMPLIANCE_PACKAGE_VERSIONING.md)

## Building the compliance ZIP

Run from repo root:

```bash
# Versioned (recommended for release)
node scripts/compliance-package.mjs --version compliance-v1
# → External-Trust-Package-compliance-v1.zip

# Or custom path
node scripts/compliance-package.mjs --version compliance-v1 --output ./releases/External-Trust-Package-compliance-v1.zip
```

The ZIP includes:

- This README and the auditor checklist
- Selected docs (retention, portal, anchoring)
- Sample/minimal ledger entry, rollup, and ROLLUP_ANCHORING_STATUS (if available or generated)
- Optional: sample pack layout description or stub

See `scripts/compliance-package.mjs` for exact contents and env options.

## Due diligence and controls

- [compliance/DUE_DILIGENCE_ANSWER_SHEET.md](./compliance/DUE_DILIGENCE_ANSWER_SHEET.md) — One-page answers for investors, banks, enterprise (what it is, integrity, immutability, reproducibility, incidents, access, 1-day checklist).
- [compliance/SOC2_CONTROL_MAPPING.md](./compliance/SOC2_CONTROL_MAPPING.md) — Simplified SOC 2–style mapping: CC6 (Logical Access), CC7 (Change Management), CC8 (System Operations), CC9 (Risk Mitigation), A1 (Availability/Integrity).

## Variant B — Regulator / SOC2 track (on request)

Formal procedure documents, added when required by regulators or SOC2:

- [compliance/INCIDENT_RESPONSE.md](./compliance/INCIDENT_RESPONSE.md) — Formal incident response for ledger/rollup/anchor
- [compliance/KEY_MANAGEMENT_POLICY.md](./compliance/KEY_MANAGEMENT_POLICY.md) — KMS/HSM, rotation, emergency revoke
- [compliance/ACCESS_REVIEW_CADENCE.md](./compliance/ACCESS_REVIEW_CADENCE.md) — Who has access to what; review cadence

## Variant C — External trust (product / public)

When offering audit integrity as a product or to external parties:

- [trust/PUBLIC_TRUST_EXPLAINER.md](./trust/PUBLIC_TRUST_EXPLAINER.md) — Public-facing “How we ensure trust” (no internals) + usage table
- [trust/HOW_WE_ENSURE_AUDIT_INTEGRITY.md](./trust/HOW_WE_ENSURE_AUDIT_INTEGRITY.md) — Technical trust page: “How we ensure audit integrity”
- [trust/AUDIT_INTEGRITY_EXPLAINER.md](./trust/AUDIT_INTEGRITY_EXPLAINER.md) — Short explainer for non-technical auditors
- **Redacted samples** — In the compliance ZIP: `samples-redacted/` (ledger, rollup, anchor proof with `[REDACTED]` for sensitive values)

## References

- [AUDIT_PACK_RETENTION.md](./AUDIT_PACK_RETENTION.md) — Ledger and rollup retention
- [AUDITOR_PORTAL.md](./AUDITOR_PORTAL.md) — Portal setup and API
- [VERIFY_POLICY.md](./VERIFY_POLICY.md) — Verification policy and fail rules
