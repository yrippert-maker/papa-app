# RACI Matrix — Key Lifecycle Governance

**Document ID:** GOV-RACI-001  
**Version:** 1.0.0  
**Effective Date:** 2026-02-02

---

## Legend

| Code | Meaning | Description |
|------|---------|-------------|
| **R** | Responsible | Does the work |
| **A** | Accountable | Ultimately answerable, approves |
| **C** | Consulted | Provides input before decision |
| **I** | Informed | Notified after decision |

---

## 1. Roles Definition

### 1.1 Primary Roles

| Role ID | Role Name | Description | Min. Headcount |
|---------|-----------|-------------|----------------|
| KC | Key Custodian | Authorized to initiate/approve key operations | 4 |
| SO | Security Officer | Break-glass authority, incident command | 2 |
| CO | Compliance Officer | Audit oversight, regulatory liaison | 1 |
| SA | System Administrator | Technical implementation | 2 |
| TL | Team Lead | Operational oversight | 2 |
| SC | Security Council | Policy approval body | 5 |
| AU | External Auditor | Independent assurance | As needed |

### 1.2 Role Qualifications

| Role | Required Training | Certification | Background Check |
|------|------------------|---------------|------------------|
| KC | Key Management 101, Security Awareness | None required | Yes |
| SO | Incident Response, Key Management Advanced | CISSP/CISM preferred | Yes (enhanced) |
| CO | Compliance Fundamentals, Audit Procedures | CIA/CISA preferred | Yes |
| SA | System Administration, Security Operations | None required | Yes |

---

## 2. Key Lifecycle Operations

### 2.1 Routine Operations

| Activity | KC | SO | CO | SA | TL | SC | AU |
|----------|----|----|----|----|----|----|-----|
| **Key Generation** |
| Initiate generation request | R | C | I | | | | |
| Approve generation | R | A | I | | | | |
| Execute generation | | | | R | I | | |
| Verify generation | R | A | I | R | | | |
| **Key Rotation** |
| Initiate rotation request | R | C | I | | | | |
| Approve rotation (standard) | R | A | I | | | | |
| Approve rotation (critical) | R | A | C | | | | |
| Execute rotation | | | | R | I | | |
| Verify rotation | R | A | I | R | | | |
| Archive old key | | | | R | I | I | |
| **Key Revocation** |
| Initiate revocation request | R | C | I | | | | |
| Document revocation reason | R | A | C | | | | |
| Approve revocation | R | A | I | | | | |
| Execute revocation | | | | R | I | | |
| Notify stakeholders | | | | | R | I | |

### 2.2 Emergency Operations

| Activity | KC | SO | CO | SA | TL | SC | AU |
|----------|----|----|----|----|----|----|-----|
| **Break-Glass Activation** |
| Activate break-glass | I | R/A | I | C | I | I | |
| Document activation reason | | R | C | | | | |
| Execute emergency operation | R | A | I | R | | | |
| Deactivate break-glass | I | R/A | I | | | | |
| **Post-Mortem** |
| Initiate post-mortem | | R | C | | | | |
| Conduct root cause analysis | C | R | C | R | | | |
| Document findings | | R | C | C | | | |
| Approve post-mortem | | | A | | | R | |
| Implement remediation | R | A | I | R | | | |

---

## 3. Governance & Compliance

### 3.1 Policy Management

| Activity | KC | SO | CO | SA | TL | SC | AU |
|----------|----|----|----|----|----|----|-----|
| Draft policy | | R | C | C | | | |
| Review policy | C | R | R | C | | | |
| Approve policy | | | C | | | R/A | |
| Implement policy controls | | | | R | | | |
| Monitor policy compliance | | | R | C | | | |
| Policy exception request | R | | C | | | | |
| Approve policy exception | | A | C | | | | |

### 3.2 Audit & Assurance

| Activity | KC | SO | CO | SA | TL | SC | AU |
|----------|----|----|----|----|----|----|-----|
| Schedule audit | | | R | | | A | |
| Prepare audit evidence | | | R | R | | | |
| Conduct internal audit | | | R | C | | | |
| Conduct external audit | | | C | C | | | R |
| Review audit findings | | C | R | C | | A | |
| Remediate findings | R | A | I | R | | | |
| Generate audit report | | | R | | | | C |
| Approve audit report | | | | | | A | |

### 3.3 Reporting

| Activity | KC | SO | CO | SA | TL | SC | AU |
|----------|----|----|----|----|----|----|-----|
| Generate daily metrics | | | | R | | | |
| Generate monthly dashboard | | | R | C | | I | |
| Generate quarterly report | | | R | C | | A | |
| Generate annual attestation | | | R | | | A | |
| Present to Board | | | C | | | R | |

---

## 4. Incident Management

### 4.1 Security Incidents

| Activity | KC | SO | CO | SA | TL | SC | AU |
|----------|----|----|----|----|----|----|-----|
| Detect incident | C | R | I | R | | | |
| Classify severity | | R/A | C | C | | | |
| Activate incident response | | R/A | I | C | | I | |
| Contain incident | R | A | I | R | | | |
| Eradicate threat | R | A | I | R | | | |
| Recover operations | R | A | I | R | I | | |
| Conduct lessons learned | C | R | C | C | | A | |
| Update controls | | R | C | R | | A | |

### 4.2 Anomaly Response

| Activity | KC | SO | CO | SA | TL | SC | AU |
|----------|----|----|----|----|----|----|-----|
| Review anomaly alerts | | R | I | C | | | |
| Triage anomaly | | R | C | C | | | |
| Investigate anomaly | C | R | C | R | | | |
| Acknowledge anomaly | | R/A | I | | | | |
| Escalate if needed | | R | I | | | A | |
| Document resolution | | R | I | C | | | |

---

## 5. Change Management

| Activity | KC | SO | CO | SA | TL | SC | AU |
|----------|----|----|----|----|----|----|-----|
| Request system change | | C | | R | | | |
| Security review | | R | C | C | | | |
| Compliance review | | | R | C | | | |
| Approve change | | A | C | | | | |
| Implement change | | | | R | | | |
| Verify change | | R | C | R | | | |
| Document change | | | | R | I | | |

---

## 6. Training & Awareness

| Activity | KC | SO | CO | SA | TL | SC | AU |
|----------|----|----|----|----|----|----|-----|
| Develop training materials | | R | C | C | | | |
| Deliver training | | R | C | | | | |
| Track training completion | | | R | | | | |
| Assess competency | | R | C | | | | |
| Certify key custodians | | A | C | | | | |
| Recertify annually | | A | R | | | | |

---

## 7. Delegation Rules

### 7.1 Permitted Delegations

| From Role | To Role | Max Duration | Approval Required |
|-----------|---------|--------------|-------------------|
| KC | KC | 30 days | TL |
| SO | SO | 14 days | SC |
| CO | CO | 30 days | SO |
| SA | SA | 30 days | TL |

### 7.2 Non-Delegable Responsibilities

- Security Council membership votes
- Annual attestation signing
- Break-glass activation (SO only)
- Policy exception final approval

---

## 8. Escalation Matrix

| Situation | Level 1 | Level 2 | Level 3 |
|-----------|---------|---------|---------|
| Approval timeout | TL | SO | SC |
| Policy violation | SO | SC | Legal |
| Security incident | SO | SC | CEO |
| Compliance finding | CO | SC | Board |
| Break-glass overdue PM | SO | SC | CEO |

---

## 9. Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-02 | Security Team | Initial release |

---

## Appendix: Role Assignment Template

| Role | Primary | Backup 1 | Backup 2 |
|------|---------|----------|----------|
| Key Custodian 1 | _______ | _______ | _______ |
| Key Custodian 2 | _______ | _______ | _______ |
| Key Custodian 3 | _______ | _______ | _______ |
| Key Custodian 4 | _______ | _______ | _______ |
| Security Officer 1 | _______ | _______ | |
| Security Officer 2 | _______ | _______ | |
| Compliance Officer | _______ | _______ | |
| System Admin 1 | _______ | _______ | |
| System Admin 2 | _______ | _______ | |
