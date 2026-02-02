# Release v0.2.1 — Governance Maturity

## Overview

v0.2.1 extends the governance layer with audit hardening, abuse resistance, and organizational scalability features.

---

## A) Audit Hardening

### External Auditor Pack
- `POST /api/compliance/audit-pack` — generate complete audit bundle
- Includes: snapshots, evidence index, retention policy, verification instructions, keys inventory
- Configurable date range and key inclusion
- Checksums + manifest for integrity

### Evidence Index
- `GET /api/compliance/audit-pack?action=evidence-index` — period → hash → signature mapping
- Hash-chained index for tamper detection

### Legal Holds
- `POST /api/compliance/legal-holds` — create/release legal holds
- Scope: date range, keys, snapshots, ledger
- Prevents accidental deletion during litigation

### New Files
- `lib/audit-pack-service.ts` — pack generation, legal holds, evidence index

---

## B) Resilience / Abuse Resistance

### Break-Glass Post-Mortem
- Mandatory review workflow after break-glass deactivation
- 72-hour deadline, status tracking (pending → in_progress → completed)
- 2-man rule: approver ≠ activator
- `GET/POST /api/compliance/postmortems`

### Anomaly Detection
- Automatic detection of suspicious patterns:
  - `FREQUENT_APPROVALS` — >5 per day per approver
  - `NEAR_EXPIRY_ABUSE` — approved within 5 min of expiry
  - `SAME_PAIR_PATTERN` — repeated initiator-approver pairs
  - `BURST_REQUESTS` — >5 requests in 30 min
  - `OFF_HOURS_ACTIVITY` — key ops 10PM-6AM UTC
- `GET /api/compliance/anomalies?action=detect` — run detection
- `POST /api/compliance/anomalies` — acknowledge alerts

### Approver Rate Limits
- 10 approvals per 24-hour window per approver
- Automatic blocking when exceeded
- Integrated into approval flow (429 RATE_LIMITED)

### New Files
- `lib/governance-resilience-service.ts` — post-mortems, anomalies, rate limits

---

## C) Scale / Org Maturity

### N-of-M Approval Policies
- Configurable per key class: standard (2-of-N), critical (3-of-N), root (4-of-5)
- Customizable timeouts, team constraints
- Org/team scoping
- `GET/POST /api/compliance/policies`

### Org/Team Governance
- Hierarchical organizations with teams
- User assignments with roles (member, lead, admin)
- `GET/POST /api/compliance/org`

### Delegated Approvers
- Temporary delegation with caps (max approvals per period)
- Scoped by key class, org, team
- Revocable
- `GET/POST /api/compliance/delegations`

### New Files
- `lib/governance-policy-service.ts` — policies, delegations, org structure

---

## API Endpoints Summary

| Category | Method | Path | Permission |
|----------|--------|------|------------|
| Audit Pack | GET | `/api/compliance/audit-pack` | ADMIN |
| Audit Pack | POST | `/api/compliance/audit-pack` | ADMIN |
| Legal Holds | GET | `/api/compliance/legal-holds` | COMPLIANCE.VIEW |
| Legal Holds | POST | `/api/compliance/legal-holds` | ADMIN |
| Post-Mortems | GET | `/api/compliance/postmortems` | COMPLIANCE.VIEW |
| Post-Mortems | POST | `/api/compliance/postmortems` | COMPLIANCE.MANAGE |
| Anomalies | GET | `/api/compliance/anomalies` | COMPLIANCE.VIEW |
| Anomalies | POST | `/api/compliance/anomalies` | COMPLIANCE.MANAGE |
| Policies | GET | `/api/compliance/policies` | COMPLIANCE.VIEW |
| Policies | POST | `/api/compliance/policies` | ADMIN |
| Delegations | GET | `/api/compliance/delegations` | COMPLIANCE.VIEW |
| Delegations | POST | `/api/compliance/delegations` | COMPLIANCE.MANAGE |
| Org | GET | `/api/compliance/org` | COMPLIANCE.VIEW |
| Org | POST | `/api/compliance/org` | ADMIN |

---

## Route Count

- Total: **52 routes** (+14 from v0.2.0)

---

## Tests

- Total: **220 tests passed**
- Build: ✅

---

## Compliance Mapping

| Feature | SOC 2 | ISO 27001 | PCI DSS |
|---------|-------|-----------|---------|
| Audit Pack | CC7.1 | A.18.1.3 | 12.10.5 |
| Legal Holds | CC7.4 | A.18.1.4 | 3.1 |
| Anomaly Detection | CC7.2 | A.12.4.1 | 10.6.1 |
| Rate Limits | CC6.7 | A.9.4.1 | 8.1.6 |
| N-of-M Policies | CC6.1 | A.9.2.3 | 3.6.4 |
| Delegations | CC6.3 | A.9.2.2 | 7.1.2 |

---

## Regulatory Bundle

```
Bundle: dist/regulatory-bundle-v0.2.1.zip
SHA-256: <TBD>
```
