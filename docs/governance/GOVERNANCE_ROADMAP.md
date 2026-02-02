# Governance Roadmap

**Document ID:** GOV-ROADMAP-001  
**Version:** 1.1.1  
**Last Updated:** 2026-02-02

---

## Overview

This document outlines the governance maturity roadmap for Papa App, organized by release version.

---

## LTS Baseline — v0.3.x

**Status:** Stable branch (effective v0.3.1)

**LTS Policy:** *LTS versions receive security and audit-related fixes only. Feature development is frozen.*

| Policy | Description |
|--------|-------------|
| **Scope** | Security and audit fixes only |
| **No new features** | v0.3.x receives only patches for vulnerabilities, compliance gaps, and audit findings |
| **Branch** | `main` (v0.3.x) or dedicated `release/0.3` if branching strategy requires |
| **Support** | Until v1.0.0 GA or explicit EOL announcement |

**Current LTS baseline:** [v0.3.1](https://github.com/yrippert-maker/papa-app/releases/tag/v0.3.1)

**Acceptable changes:**
- Security patches (CVEs, vulnerability fixes)
- Audit remediation (evidence, attestation, policy corrections)
- Bug fixes in verification/attestation/ledger flows
- Documentation corrections for compliance

---

## Operational Cadence

**Target:** Automated compliance operations in CI

| Capability | Schedule | Automation |
|------------|----------|------------|
| **Quarterly attestation** | Every quarter | CI job: `attestation:quarterly` |
| **Annual attestation** | Yearly | CI job: `attestation:annual` |
| **Auditor pack publishing** | On schedule (e.g. quarterly) | CI: `auditor-pack:create` + GitHub Release |
| **Trust anchors export** | On key rotation | Manual or CI-triggered |

### CI Integration (Planned)

- [ ] Scheduled workflow: quarterly attestation generation
- [ ] Scheduled workflow: annual attestation generation
- [ ] Scheduled workflow: fresh auditor pack build + publish
- [ ] Artifact retention policy for packs

---

## Current State (v0.3.1)

### ✅ Implemented

| Capability | Description | Status |
|------------|-------------|--------|
| **Policy Repository** | Versioned policies in Git | ✅ Complete |
| **Policy Changelog** | Automated change tracking | ✅ Complete |
| **Attestation Service** | Signed periodic statements | ✅ Complete |
| **Trust Anchors** | 3rd-party verification bundle | ✅ Complete |
| **STRIDE Threat Model** | Comprehensive threat analysis | ✅ Complete |
| **Anomaly Detection** | STRIDE-mapped anomaly system | ✅ Complete |
| **Red Team Scenarios** | Security testing playbook | ✅ Complete |
| **2-Man Rule** | Key lifecycle approval | ✅ Complete |
| **Hash-Chain Ledger** | Immutable audit trail | ✅ Complete |
| **Evidence Signing** | Ed25519 digital signatures | ✅ Complete |
| **Independent Verifier Pack** | Audit-grade auditor pack (v0.3.1) | ✅ Complete |

---

## v0.4.0 — Security Enhancement

**Target:** Q2 2026

### Features

| Feature | Priority | Description |
|---------|----------|-------------|
| **MFA (TOTP)** | High | Time-based one-time password support |
| **Account Lockout** | High | Auto-lock after failed attempts |
| **CAPTCHA Integration** | Medium | Bot protection for auth endpoints |
| **Session Management** | Medium | Concurrent session limits |
| **IP Allowlisting** | Low | Restrict admin access by IP |

### Deliverables

- [ ] TOTP enrollment flow
- [ ] Recovery codes generation
- [ ] Lockout policy configuration
- [ ] Session dashboard UI

---

## v0.5.0 — Enterprise Readiness

**Target:** Q3 2026

### Features

| Feature | Priority | Description |
|---------|----------|-------------|
| **HSM Integration** | High | Hardware security module for keys |
| **SAML/OIDC SSO** | High | Enterprise identity provider support |
| **Multi-Tenant** | Medium | Organization isolation |
| **Audit Log Export** | Medium | SIEM integration format |
| **Custom Policies** | Low | User-defined approval policies |

### Deliverables

- [ ] HSM adapter interface
- [ ] SAML 2.0 integration
- [ ] Tenant provisioning workflow
- [ ] Splunk/ELK export format

---

## v0.6.0 — Automation & Intelligence

**Target:** Q4 2026

### Features

| Feature | Priority | Description |
|---------|----------|-------------|
| **Anomaly Dashboard** | High | Real-time threat visualization |
| **Automated Red Team** | High | Scheduled security tests |
| **Risk Scoring** | Medium | ML-based risk assessment |
| **Compliance Automation** | Medium | Auto-generate compliance reports |
| **Policy Recommendations** | Low | AI-suggested policy updates |

### Deliverables

- [ ] Real-time anomaly charts
- [ ] Automated scenario execution
- [ ] Risk score API
- [ ] SOC 2 report generator

---

## v1.0.0 — Production Certification

**Target:** Q1 2027 (or after independent dry-run audit, whichever is later)

### Milestones

| Milestone | Description |
|-----------|-------------|
| **Governance Charter** | Formal announcement of governance charter — published, versioned, signed |
| **Independent Dry-Run Audit** | 3rd-party dry-run audit using auditor pack — see [DRY_RUN_AUDIT_PLAN](DRY_RUN_AUDIT_PLAN.md) |
| **SOC 2 Type II** | Complete audit certification |
| **ISO 27001** | Information security certification |
| **Penetration Test** | External security assessment |
| **Production Hardening** | Final security review |
| **Documentation Complete** | All governance docs finalized |

### Prerequisites

- [ ] All v0.x features stable
- [ ] 6+ months production history
- [ ] No critical vulnerabilities
- [ ] Complete audit evidence
- [ ] Governance charter ratified and published
- [ ] 3rd-party dry-run audit completed (auditor pack verification)

### Remaining to v1.0.0 (Execution Only)

*Только исполнение, не проектирование.*

| # | Step | Done |
|---|------|------|
| 1 | Провести Independent Dry-Run Audit по [плану](DRY_RUN_AUDIT_PLAN.md) | ☑ internal ([report](DRY_RUN_AUDIT_REPORT.md)); ☐ 3rd-party |
| 2 | Получить отчёт (без critical findings) | ☑ internal; ☐ 3rd-party |
| 3 | Ратифицировать Governance Charter (подписи CTO, CISO, Legal) | ☑ |
| 4 | Выпустить v1.0.0 как формальное объявление зрелости | ☑ (tag pushed; GitHub Release — attach pack) |

---

## Governance Maturity Model

### Level 1: Basic (v0.1.x)
- ✅ Authentication
- ✅ Basic authorization
- ✅ Audit logging

### Level 2: Managed (v0.2.x)
- ✅ RBAC
- ✅ 2-man rule
- ✅ Evidence signing
- ✅ Hash-chain ledger

### Level 3: Defined (v0.3.x) ← **Current (LTS)**
- ✅ Formal policies
- ✅ Attestations
- ✅ Threat modeling
- ✅ Anomaly detection

### Level 4: Quantitatively Managed (v0.4.x - v0.5.x)
- 🔲 MFA
- 🔲 HSM
- 🔲 SSO
- 🔲 SIEM integration

### Level 5: Optimizing (v0.6.x - v1.0.x)
- 🔲 Automated testing
- 🔲 Risk scoring
- 🔲 Compliance automation
- 🔲 Certification

---

## Key Metrics

### Current Metrics (v0.3.1)

| Metric | Target | Current |
|--------|--------|---------|
| Policy coverage | 100% | 100% |
| Threat coverage (STRIDE) | 100% | 100% |
| Anomaly detection coverage | 80% | 75% |
| Red team scenario coverage | 50% | 50% |
| Attestation automation | 100% | 100% |

### Target Metrics (v1.0.0)

| Metric | Target |
|--------|--------|
| MFA adoption | 100% for admins |
| Key operations via HSM | 100% |
| Automated compliance checks | 90% |
| Mean time to detect anomaly | < 5 min |
| Mean time to respond | < 1 hour |

---

## Review Schedule

| Review | Frequency | Owner |
|--------|-----------|-------|
| Roadmap update | Quarterly | Security Council |
| Feature prioritization | Monthly | Product + Security |
| Metrics review | Monthly | Compliance Team |
| External audit | Annually | External Auditor |

---

## Dependencies

### External
- HSM vendor selection (v0.5.0)
- SSO provider integration (v0.5.0)
- SIEM platform selection (v0.5.0)
- Audit firm engagement (v1.0.0)

### Internal
- Database migration to PostgreSQL (optional)
- Performance optimization
- UI/UX improvements
- Documentation updates

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| HSM vendor lock-in | Medium | High | Abstract HSM interface |
| SSO complexity | Medium | Medium | Phased rollout |
| Compliance timeline slip | Low | High | Buffer in schedule |
| Resource constraints | Medium | Medium | Prioritize critical features |

---

## Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-02 | Initial roadmap |
| 1.1.0 | 2026-02-02 | LTS baseline (v0.3.x), operational cadence, v1.0.0 governance charter + 3rd-party audit |
| 1.1.1 | 2026-02-02 | Explicit LTS policy, link to v0.3.1, v1.0.0 target clarification |
