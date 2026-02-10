# Independent Dry-Run Audit Plan

**Document ID:** GOV-AUDIT-001  
**Version:** 1.0.0  
**Created:** 2026-02-02  
**Owner:** Security & Compliance Team  
**Purpose:** Define scope, artifacts, and criteria for 3rd-party independent verification of Papa App governance evidence

---

## 1. Objective

Enable an **independent 3rd-party auditor** to perform a **dry-run verification** of Papa App's governance and compliance evidence without access to internal systems. The auditor uses only publicly available artifacts (auditor pack) and standard tooling (Node.js).

---

## 2. Scope

### 2.1 In Scope

| Area | Description | Verification Method |
|------|-------------|----------------------|
| **Pack integrity** | All files match recorded checksums | `verify.mjs` checksum validation |
| **Provenance** | Pack traceable to specific release | `MANIFEST.source_git` (tag, commit, origin) |
| **Trust anchors** | Public keys present and structured | `trust-anchors.json` structure |
| **Policy index** | Governance policies versioned and indexed | `policies/POLICY_INDEX.json` + policy files |
| **Snapshot chain** | Audit snapshots have valid hash chain | `verify.mjs` chain verification |
| **Attestations** | Signed compliance statements present | `attestations/*.json` structure and hash |
| **Verifier** | Standalone script produces deterministic result | `node verify.mjs` / `node verify.mjs --strict` |

### 2.2 Out of Scope (Dry-Run)

| Area | Reason |
|------|--------|
| Live system access | Dry-run is offline, artifact-only |
| Source code review | Separate engagement |
| Penetration testing | Separate engagement |
| Operational controls | Requires production access |
| Key material | Only public keys in pack |

---

## 3. Artifacts

### 3.1 Primary Artifact: Auditor Pack

**Format:** `auditor-pack-YYYY-MM-DDTHH-MM-SS.tar.gz`  
**Source:** [GitHub Releases](https://github.com/yrippert-maker/papa-app/releases) (tag v0.3.1 or later)  
**SHA-256:** Published in release notes (authoritative for pack integrity)

### 3.2 Pack Contents (Expected)

| Path | Description | Required for PASSED (strict) |
|------|-------------|-------------------------------|
| `MANIFEST.json` | Pack metadata, provenance, checksums | Yes |
| `trust-anchors.json` | Public keys for verification | Yes |
| `verify.mjs` | Standalone verifier script | Yes |
| `VERIFY.md` | Verification instructions | Yes |
| `policies/POLICY_INDEX.json` | Policy index | Yes |
| `policies/*.json` | Policy definitions | Yes |
| `snapshots/*.json` | Audit snapshots | Yes (strict mode) |
| `attestations/*.json` | Signed attestations | Yes (strict mode) |

### 3.3 Supporting Documents (External)

| Document | Location | Purpose |
|----------|----------|---------|
| Governance Charter | `docs/governance/GOVERNANCE_CHARTER.md` | Governance framework |
| Governance Roadmap | `docs/governance/GOVERNANCE_ROADMAP.md` | Maturity and LTS policy |
| Approval Policy Spec | `docs/governance/APPROVAL_POLICY_SPEC.md` | Key approval rules |
| Release Notes v0.3.1 | `docs/GITHUB_RELEASE_NOTES_v0.3.1.md` | Pack features and usage |

---

## 4. Verification Criteria

### 4.1 Pass/Fail (Permissive Mode)

| Criterion | Pass | Fail |
|-----------|------|------|
| Checksums | All files match MANIFEST.checksums | Any mismatch |
| Trust anchors | File present, valid JSON | Missing or invalid |
| Policies | POLICY_INDEX + active policies present | Missing or invalid |
| Verifier exit code | 0 | Non-zero |
| Result | `PASSED` (warnings allowed) | `FAILED` |

### 4.2 Pass/Fail (Strict Mode)

| Criterion | Pass | Fail |
|-----------|------|------|
| All permissive criteria | Met | Not met |
| Snapshots | ≥1 snapshot, chain valid | None or chain broken |
| Attestations | ≥1 attestation, hash valid | None or invalid |
| Warnings | 0 | >0 |
| Result | `PASSED` | `FAILED` |

### 4.3 Provenance Verification

| Check | Method |
|-------|--------|
| Tag matches release | `MANIFEST.source_git.tag` = release tag (e.g. v0.3.1) |
| Commit exists | `git ls-remote` or GitHub API: commit in repo |
| Pack SHA-256 | Compare downloaded file vs release notes (authoritative source) |

---

## 5. Audit Process (3rd-Party Auditor)

### 5.1 Prerequisites

- Node.js 18+ LTS
- Internet access (to download pack; verification is offline)
- No npm install required

### 5.2 Steps

1. **Download** auditor pack from GitHub Release (e.g. v0.3.1)
2. **Verify download** — compare SHA-256 with release notes
3. **Extract** — `tar -xzf auditor-pack-*.tar.gz`
4. **Run verifier (permissive)** — `node verify.mjs`
   - Expect: `RESULT: ✓ VERIFICATION PASSED` (warnings acceptable)
5. **Run verifier (strict)** — `node verify.mjs --strict`
   - Expect: `PASSED` if pack has snapshots + attestations; `FAILED` otherwise (document reason)
6. **Run verifier (JSON)** — `node verify.mjs --json`
   - Capture machine-readable result for report
7. **Inspect MANIFEST** — confirm provenance (tag, commit, origin)
8. **Inspect policies** — confirm structure, versioning
9. **Document findings** — use template below

### 5.3 Duration Estimate

| Phase | Estimate |
|-------|----------|
| Download and setup | 15 min |
| Verification runs | 15 min |
| Artifact inspection | 30 min |
| Report drafting | 1–2 hours |
| **Total** | **2–3 hours** |

---

## 6. Deliverables (Auditor Report)

### 6.1 Report Structure

1. **Executive summary** — Pass/Fail, key findings
2. **Scope** — Confirmation of dry-run scope
3. **Methodology** — Steps performed
4. **Artifacts reviewed** — Pack ID, release tag, SHA-256
5. **Verification results** — Permissive and strict mode outcomes
6. **Provenance assessment** — Traceability to source
7. **Findings** — Any gaps, recommendations
8. **Conclusion** — Suitability for governance evidence

### 6.2 Sample Finding Format

| ID | Severity | Description | Recommendation |
|----|----------|-------------|----------------|
| DRY-001 | Info | Pack lacks snapshots (bootstrap) | Add snapshots for strict PASSED |
| DRY-002 | — | Provenance verified | — |

---

## 7. Success Criteria (Dry-Run Complete)

| Criterion | Description |
|-----------|-------------|
| **Integrity** | `verify.mjs` reports PASSED (permissive) or PASSED (strict) |
| **Provenance** | Tag, commit, origin traceable and consistent |
| **Documentation** | Auditor report delivered with findings |
| **No critical findings** | No integrity failures, no provenance gaps |

---

## 8. Post Dry-Run

- Address findings (e.g. add snapshots/attestations for strict PASSED)
- Publish Governance Charter formally (v1.0.0 milestone)
- Consider full audit engagement for SOC 2 / ISO 27001

---

## 9. References

- [GITHUB_RELEASE_NOTES_v0.3.1](../GITHUB_RELEASE_NOTES_v0.3.1.md)
- [GOVERNANCE_CHARTER](GOVERNANCE_CHARTER.md)
- [GOVERNANCE_ROADMAP](GOVERNANCE_ROADMAP.md)
- Auditor pack: https://github.com/yrippert-maker/papa-app/releases

---

## Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-02 | Initial plan |
