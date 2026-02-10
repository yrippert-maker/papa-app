# LTS Policy — v0.3.x / v1.0.x

**Document ID:** OPS-LTS-001  
**Version:** 1.0.0  
**Effective:** 2026-02-02  
**Branch:** main (v0.3.x LTS baseline)

---

## Policy

**LTS versions receive security and audit-related fixes only. Feature development is frozen.**

---

## Change Policy

| Change Type | Allowed | Examples |
|-------------|---------|----------|
| **Security patches** | ✓ | CVEs, vulnerability fixes |
| **Audit remediation** | ✓ | Evidence corrections, attestation fixes, policy updates |
| **Verification/ledger bug fixes** | ✓ | Checksum, chain, signing fixes |
| **Documentation (compliance)** | ✓ | Governance docs, runbooks |
| **New features** | ✗ | No new capabilities |
| **API changes** | ✗ | No breaking or additive API |
| **UI changes (non-remediation)** | ✗ | No new screens, flows |

---

## Changelog

- **Strict, append-only**
- Format: `[TYPE] description` where TYPE ∈ {SECURITY, AUDIT, FIX, DOCS}
- No removal or rewriting of entries
- Every change must have a changelog entry

---

## Feature Freeze

- **Effective:** v0.3.1 (LTS baseline)
- **Scope:** All application code, APIs, UI
- **Exception:** Security Council approval for critical security features (e.g. MFA)

---

## References

- [GOVERNANCE_ROADMAP](../governance/GOVERNANCE_ROADMAP.md) — LTS Baseline section
- [GOVERNANCE_CADENCE](GOVERNANCE_CADENCE.md) — Operational cadence
