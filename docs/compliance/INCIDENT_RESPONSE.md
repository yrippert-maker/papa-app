# Incident Response — Evidence Ledger & Audit Trail

**Scope:** Incidents affecting the evidence ledger, rollups, anchoring, pack signing, or auditor-facing services.  
**Track:** Regulator / SOC2. Use this document when formal IR procedures are required.

---

## 1. Definitions

- **Security incident:** Unauthorized access, tampering, or loss of integrity/availability of ledger, rollups, signing keys, or audit artifacts.
- **Operational incident:** Failure (e.g. pipeline, storage, anchor publish) that impacts evidence completeness or verifiability without confirmed compromise.

## 2. Roles

| Role | Responsibility |
|------|----------------|
| **Incident lead** | Coordinates response, communications, post-incident review. |
| **Technical owner** | Ledger/rollup/anchor pipeline and storage. |
| **Security** | Key compromise, access abuse, forensics. |
| **Compliance / Legal** | Regulatory notification, audit impact, disclosure. |

## 3. Severity

- **Critical:** Key compromise, confirmed tampering of ledger/rollup, or permanent loss of evidence for a period.
- **High:** Unavailability of ledger/rollup/anchor for > 24h; or suspected (unconfirmed) tampering.
- **Medium:** Single-day gap in rollup/anchor; recoverable pipeline failure.
- **Low:** Minor delay or transient failure with no evidence gap.

## 4. Response phases

### 4.1 Detection & Triage

- Identify source (alert, audit finding, user report).
- Classify as security vs operational; assign severity.
- Assign incident lead and notify Technical owner, Security, Compliance as per severity.

### 4.2 Containment

- **Key compromise:** Revoke/rotate key per [KEY_MANAGEMENT_POLICY.md](./KEY_MANAGEMENT_POLICY.md); cease use of compromised key for new signatures.
- **Tampering suspected:** Preserve logs and current state; do not overwrite or delete ledger/rollup objects; enable versioning if not already.
- **Availability:** Restore from backup or failover per runbooks; document any gap in evidence (dates, scope).

### 4.3 Eradication & Recovery

- Remove cause (e.g. rotate credentials, patch, fix pipeline).
- Restore normal operation and verify ledger/rollup/anchor pipeline end-to-end.
- If evidence gap exists: document in incident report; consider regulatory/auditor notification per Compliance.

### 4.4 Post-incident

- **Incident report:** What happened, root cause, impact (including audit trail impact), actions taken, preventive measures.
- **Review:** Update runbooks, access, or key procedures if needed.
- **Retention:** Retain incident report and relevant logs per policy (e.g. 1–2 years for SOC2/regulatory).

## 5. Notification

- **Internal:** Per severity — Incident lead notifies Technical owner, Security, Compliance.
- **External (regulators / auditors):** Per Compliance/Legal; typically for Critical or when evidence integrity or availability is materially affected.
- **Customer-facing:** If the product includes “audit integrity” commitments, coordinate with Legal/Comms for any public or customer notification.

## 6. Document control

- Version and approval: [To be set by your org]
- Next review: [Date]
- Owner: [Role/Team]
