# Governance Charter

**Document ID:** GOV-CHARTER-001  
**Version:** 1.0.0  
**Effective Date:** 2026-02-02  
**Last Review:** 2026-02-02  
**Next Review:** 2026-08-02  
**Owner:** Security & Compliance Team  
**Approvers:** CTO, CISO, Legal

---

## Publication Status

| Status | Value |
|--------|-------|
| **Current** | Ratified |
| **Ratification date** | 2026-02-02 |
| **Formal announcement** | v1.0.0 |

*Ratified upon completion of independent dry-run audit. See [Ratification Record](RATIFICATION_RECORD.md).*

---

## 1. Purpose

This charter establishes the governance framework for cryptographic key lifecycle management within the Papa App platform. It defines roles, responsibilities, processes, and controls that ensure security, compliance, and operational integrity.

---

## 2. Scope

### 2.1 In Scope

- All cryptographic signing keys (evidence signing, API authentication)
- Key lifecycle operations: generation, rotation, revocation, archival
- Approval workflows and access controls
- Audit and compliance reporting
- Emergency procedures (break-glass)

### 2.2 Out of Scope

- Application-level encryption keys (covered by separate policy)
- Third-party service credentials (covered by secrets management policy)
- User authentication credentials (covered by IAM policy)

---

## 3. Governance Principles

### 3.1 Separation of Duties

No single individual may both initiate and approve key lifecycle operations. The 2-man rule is mandatory for all key classes.

### 3.2 Least Privilege

Access to key management functions is granted only to those with demonstrated need and appropriate training.

### 3.3 Auditability

All key lifecycle operations are logged to an immutable ledger with cryptographic integrity verification.

### 3.4 Transparency

Governance policies, procedures, and audit results are documented and available for internal and external review.

### 3.5 Continuous Improvement

Governance controls are reviewed at least semi-annually and after any significant incident.

---

## 4. Organizational Structure

### 4.1 Governance Bodies

| Body | Responsibility | Meeting Cadence |
|------|---------------|-----------------|
| Security Council | Policy approval, risk acceptance | Monthly |
| Key Management Committee | Operational oversight, incident review | Bi-weekly |
| Compliance Team | Audit coordination, regulatory liaison | As needed |

### 4.2 Key Roles

| Role | Description | Count |
|------|-------------|-------|
| Key Custodian | Authorized to initiate/approve key operations | Min. 4 |
| Security Officer | Break-glass authority, incident commander | Min. 2 |
| Compliance Officer | Audit oversight, policy compliance | Min. 1 |
| System Administrator | Technical implementation, monitoring | Min. 2 |

---

## 5. Policy Framework

### 5.1 Policy Hierarchy

```
Governance Charter (this document)
    │
    ├── Approval Policy Specification (GOV-POLICY-001)
    │
    ├── Key Classification Standard (GOV-CLASS-001)
    │
    ├── Incident Response Procedure (GOV-IR-001)
    │
    └── Audit & Reporting Standard (GOV-AUDIT-001)
```

### 5.2 Policy Versioning

All policies are version-controlled with:
- Semantic versioning (MAJOR.MINOR.PATCH)
- Change log with rationale
- Approval signatures (digital or documented)
- Effective dates and review cycles

---

## 6. Approval Requirements

### 6.1 Key Class Definitions

| Class | Description | Examples |
|-------|-------------|----------|
| Standard | Routine operational keys | Evidence signing, API tokens |
| Critical | High-value or compliance-sensitive | Audit signing, regulatory submission |
| Root | Foundation keys, rarely changed | CA root, master signing |

### 6.2 Approval Matrix

| Operation | Standard | Critical | Root |
|-----------|----------|----------|------|
| Rotation | 2-of-N | 3-of-N | 4-of-5 quorum |
| Revocation | 2-of-N | 3-of-N | 4-of-5 quorum |
| Emergency (break-glass) | 1 + post-mortem | 1 + post-mortem | Not applicable* |

*Root key break-glass requires Board-level approval within 24 hours.

### 6.3 Timeout Constraints

| Class | Approval Timeout | Execution Timeout |
|-------|-----------------|-------------------|
| Standard | 24 hours | 1 hour |
| Critical | 48 hours | 2 hours |
| Root | 72 hours | 4 hours |

---

## 7. Emergency Procedures

### 7.1 Break-Glass Protocol

1. **Activation**: Security Officer activates break-glass with documented reason
2. **Duration**: Maximum 4 hours, auto-expires
3. **Actions**: All operations logged with `break_glass: true` flag
4. **Deactivation**: Manual or automatic on expiry
5. **Post-Mortem**: Mandatory within 72 hours

### 7.2 Post-Mortem Requirements

- Root cause analysis
- Remediation actions
- Policy update recommendations
- Approval by different Security Officer

---

## 8. Audit & Compliance

### 8.1 Continuous Monitoring

- All operations logged to immutable ledger
- Anomaly detection runs continuously
- Alerts for policy violations

### 8.2 Periodic Reviews

| Review Type | Frequency | Owner |
|-------------|-----------|-------|
| Access review | Quarterly | Security Officer |
| Policy review | Semi-annually | Security Council |
| Penetration test | Annually | External vendor |
| Compliance audit | Annually | Compliance Officer |

### 8.3 Reporting

- Monthly governance dashboard
- Quarterly compliance report
- Annual governance attestation

---

## 9. Enforcement

### 9.1 Policy Violations

| Severity | Example | Response |
|----------|---------|----------|
| Minor | Late post-mortem | Warning, training |
| Major | Bypassing approval | Access suspension, investigation |
| Critical | Unauthorized key access | Immediate revocation, legal review |

### 9.2 Exception Process

1. Exception request with business justification
2. Risk assessment by Security Officer
3. Time-limited approval (max 90 days)
4. Documented in exception register

---

## 10. Document Control

### 10.1 Change History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-02 | Security Team | Initial release |

### 10.2 Approval Signatures (Ratified 2026-02-02)

| Role | Name | Date | Signature |
|------|------|------|-----------|
| CTO | _____________ | 2026-02-02 | _____________ |
| CISO | _____________ | 2026-02-02 | _____________ |
| Legal | _____________ | 2026-02-02 | _____________ |

---

## 11. References

- [NIST SP 800-57: Key Management](https://csrc.nist.gov/publications/detail/sp/800-57-part-1/rev-5/final)
- [ISO 27001:2022 Annex A.10](https://www.iso.org/standard/27001)
- [PCI DSS v4.0 Requirement 3.6](https://www.pcisecuritystandards.org/)
- [SOC 2 Trust Services Criteria](https://www.aicpa.org/soc2)

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| 2-man rule | Requirement for two independent approvals |
| Break-glass | Emergency bypass of normal controls |
| Key custodian | Individual authorized for key operations |
| Post-mortem | Structured incident review |
| Quorum | Minimum number of approvers required |
