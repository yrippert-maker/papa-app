# Release v0.3.0 — Governance Formalization & Threat Modeling

**Release Date:** 2026-02-02  
**Tag:** `v0.3.0`

---

## Overview

This release introduces comprehensive **governance formalization**, **assurance infrastructure**, and **threat modeling** capabilities. It transforms Papa App from an operational compliance system into a fully auditable, threat-aware platform suitable for regulatory scrutiny.

---

## What's New

### 🏛️ Governance Formalization (v0.3.0-alpha)

#### Policy Repository
- **Versioned policies** stored in `schemas/policies/` with Git-friendly format
- JSON Schema validation for all policies (`approval-policy-v1.json`)
- Default policies for all key classes (standard, critical, root)
- Automatic policy index generation (`POLICY_INDEX.json`)

#### Governance Changelog
- **Automatic tracking** of all policy changes
- Machine-readable format (`CHANGELOG.json`) + human-readable (`CHANGELOG.md`)
- Change types: created, updated, deprecated, archived
- Full audit trail with changed_by/approved_by metadata

#### Attestation Service
- **Signed periodic attestations** (quarterly, annual, ad-hoc)
- Hash-chained attestation statements
- Compliance metrics aggregation
- Standard assertions generation

### 🔐 Assurance & Trust (v0.3.0-beta)

#### Trust Anchors Export
- **Cryptographic trust bundle** for 3rd-party verification
- Public keys with fingerprints and status
- Policy hashes for integrity verification
- Attestation chain roots

#### Attestation Schedule
- npm scripts for scheduled attestation generation
- `npm run attestation:quarterly` — Q1-Q4 attestations
- `npm run attestation:annual` — Fiscal year attestations
- `npm run attestation:list` — List existing attestations

#### Independent Verification
- `npm run verify:independent` — 3rd-party runnable verification
- Audit pack verification with checksums
- Snapshot chain verification
- Evidence index validation

### 🛡️ Threat Modeling (v0.3.0-rc)

#### STRIDE Threat Model
- **Comprehensive threat analysis** for all system components
- 24 identified threats across 6 STRIDE categories
- Trust boundary diagrams
- Data flow diagrams for critical operations
- Attack trees for key compromise scenarios
- Risk matrix with prioritization

#### Anomaly Classification System
- **18 anomaly types** mapped to STRIDE threats
- Severity levels: Critical, High, Medium, Low, Info
- Detection methods: Threshold, Pattern, Baseline drift
- Automated response actions

#### Anomaly Detection Service
- Real-time anomaly detection (`lib/anomaly-detection-service.ts`)
- Ledger integration for audit trail
- Specific detectors:
  - `detectFailedLogin()` — AUTH-001
  - `detectSelfApprovalAttempt()` — AUTHZ-004
  - `detectPermissionDenied()` — AUTHZ-002
  - `detectBreakGlassActivation()` — KEY-002
  - `detectLedgerChainBroken()` — DATA-001
  - `detectPolicyDrift()` — DATA-003

#### Red Team Scenarios
- **14 documented scenarios** for security testing
- Break-glass abuse scenarios (BG-001 to BG-003)
- 2-man rule bypass scenarios (2MR-001 to 2MR-003)
- Privilege escalation scenarios (PE-001 to PE-003)
- Audit trail tampering scenarios (AT-001 to AT-003)
- Key compromise scenarios (KC-001 to KC-002)
- Quarterly execution schedule
- Reporting template

---

## New Files

### Services
- `lib/policy-repository.ts` — Policy management service
- `lib/attestation-service.ts` — Attestation generation service
- `lib/trust-anchors-service.ts` — Trust anchors export
- `lib/anomaly-detection-service.ts` — Anomaly detection

### Schemas
- `schemas/policies/POLICY_INDEX.json` — Policy index
- `schemas/policies/standard-key-v1.0.0.json` — Standard key policy
- `schemas/policies/critical-key-v1.0.0.json` — Critical key policy
- `schemas/policies/root-key-v1.0.0.json` — Root key policy
- `schemas/policies/CHANGELOG.json` — Policy changelog (machine-readable)
- `schemas/policies/CHANGELOG.md` — Policy changelog (human-readable)

### Scripts
- `scripts/generate-attestation.mjs` — Attestation CLI
- `scripts/export-trust-anchors.mjs` — Trust anchors CLI

### Documentation
- `docs/security/THREAT_MODEL.md` — STRIDE threat model
- `docs/security/ANOMALY_CLASSIFICATION.md` — Anomaly classification
- `docs/security/RED_TEAM_SCENARIOS.md` — Red team scenarios

---

## New npm Scripts

| Script | Description |
|--------|-------------|
| `attestation:quarterly` | Generate quarterly attestation |
| `attestation:annual` | Generate annual attestation |
| `attestation:list` | List existing attestations |
| `trust-anchors:export` | Export trust anchors bundle |
| `trust-anchors:keys` | Export public keys only |
| `trust-anchors:list` | List trust anchor bundles |
| `verify:independent` | Run independent verification |

---

## Compliance Mapping

| Feature | SOC 2 | ISO 27001 | PCI DSS |
|---------|-------|-----------|---------|
| Policy versioning | CC8.1 | A.5.1.2 | 12.1 |
| Attestations | CC4.1 | A.18.2.1 | 12.11 |
| Threat modeling | CC3.2 | A.6.1.2 | 6.5 |
| Anomaly detection | CC7.2 | A.12.4.1 | 10.6 |
| Red team testing | CC7.1 | A.18.2.3 | 11.3 |

---

## Breaking Changes

None. This release is fully backward compatible.

---

## Upgrade Notes

1. **No migration required** — All new features are additive
2. **Review threat model** — Familiarize team with `docs/security/THREAT_MODEL.md`
3. **Schedule red team** — Plan first engagement using `RED_TEAM_SCENARIOS.md`
4. **Configure attestations** — Set up quarterly attestation schedule

---

## Verification

```bash
# Verify installation
npm run lint
npm run test

# Generate first attestation (optional)
npm run attestation:quarterly -- --quarter Q1 --year 2026

# Export trust anchors (optional)
npm run trust-anchors:export -- --org "Your Organization"
```

---

## Contributors

- Security Team — Threat modeling, red team scenarios
- Compliance Team — Attestation service, policy repository
- Engineering — Implementation and integration

---

## Next Steps (v0.4.0 Roadmap)

1. **MFA Support** — TOTP-based multi-factor authentication
2. **HSM Integration** — Hardware security module for key storage
3. **Anomaly Dashboard** — Real-time anomaly visualization
4. **Automated Red Team** — Scheduled security testing
