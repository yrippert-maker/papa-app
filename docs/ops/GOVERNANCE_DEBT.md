# Governance Debt Monitoring

**Document ID:** OPS-DEBT-001  
**Version:** 1.0.0  
**Last Updated:** 2026-02-02

---

## Overview

Governance debt = unaddressed compliance gaps that accumulate risk. Monitor and remediate to maintain audit-grade posture.

---

## Debt Categories

### 1. Unresolved Anomalies

| Check | Source | Action |
|-------|--------|--------|
| Anomalies without remediation | Anomaly detection service | Triage, remediate, or accept with documented rationale |
| Open anomaly tickets | Issue tracker | Close or document exception |

**Command:** Review `/api/compliance/anomalies` output; check anomaly dashboard.

---

### 2. Overdue Approvals

| Check | Source | Action |
|-------|--------|--------|
| Key lifecycle requests past timeout | Key requests API | Escalate or reject |
| Pending approvals > SLA | `compliance/requests` | Notify approvers |

**Commands:**
- `npm run expire:requests` — expire stale requests
- `npm run governance-debt:check` — summary of debt (overdue approvals, etc.)

---

### 3. Break-Glass Without Post-Mortem

| Check | Source | Action |
|-------|--------|--------|
| Break-glass events | Ledger / audit log | Require post-mortem within 72h |
| Post-mortem not filed | Postmortems API | Block until completed |

**Reference:** [GOVERNANCE_CHARTER](../governance/GOVERNANCE_CHARTER.md) § 7.2

---

## Monitoring Cadence

| Check | Frequency | Owner |
|-------|-----------|-------|
| Anomaly review | Weekly | Security Officer |
| Approval backlog | Weekly | Key Management Committee |
| Break-glass post-mortem | Per event | Security Officer |
| Governance debt dashboard | Monthly | Compliance Team |

---

## Debt Register (Template)

| ID | Category | Description | Opened | Status |
|----|----------|-------------|--------|--------|
| — | — | — | — | — |

*Populate from operational findings.*

---

## References

- [GOVERNANCE_CHARTER](../governance/GOVERNANCE_CHARTER.md)
- [RUNBOOK_EVIDENCE_VERIFY](RUNBOOK_EVIDENCE_VERIFY.md)
- [LEDGER_DEAD_LETTER](LEDGER_DEAD_LETTER.md)
