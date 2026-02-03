# Governance Cadence

**Document ID:** OPS-CADENCE-001  
**Version:** 1.0.0  
**Last Updated:** 2026-02-02

---

## Overview

Operational cadence for LTS governance — automated compliance operations that run on schedule. **Permanent baseline** for audit-grade operation.

---

## CI Schedule

| Job | Schedule | Description |
|-----|----------|-------------|
| **Quarterly attestation** | 1st of Jan, Apr, Jul, Oct 00:00 UTC | `npm run attestation:quarterly` |
| **Annual attestation** | 1st of Jan 00:00 UTC | `npm run attestation:annual` |
| **Auditor pack** | 1st of Jan, Apr, Jul, Oct 00:00 UTC | `npm run auditor-pack:create` |

**Workflow:** [.github/workflows/governance-cadence.yml](../../.github/workflows/governance-cadence.yml)

**Manual trigger:** Actions → Governance Cadence → Run workflow

---

## Artifacts

| Artifact | Retention | Location |
|----------|------------|----------|
| auditor-pack-*.tar.gz | 90 days | GitHub Actions artifacts |
| attestations/*.json | 365 days | GitHub Actions artifacts |

**Note:** For production, attestations should be committed to workspace or published to a release. CI artifacts are for verification; apply to real workspace manually if needed.

---

## Prerequisites

- `WORKSPACE_ROOT` with `00_SYSTEM/attestations`, `00_SYSTEM/keys`
- For signed attestations: evidence-signing keys configured
- Attestation may fail in CI if keys not configured — `continue-on-error: true`

---

## References

- [GOVERNANCE_ROADMAP](../governance/GOVERNANCE_ROADMAP.md) — Operational Cadence section
- [LTS_POLICY](LTS_POLICY.md) — Feature freeze, change policy
