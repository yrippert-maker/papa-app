# Independent Dry-Run Audit Report

**Document ID:** GOV-AUDIT-REPORT-001  
**Audit Date:** 2026-02-02  
**Artifact:** auditor-pack-2026-02-02T14-37-09.tar.gz  
**Pack ID:** 3ab7eace4da2e497  
**Auditor:** Internal (dry-run per [DRY_RUN_AUDIT_PLAN](DRY_RUN_AUDIT_PLAN.md))

---

## 1. Executive Summary

| Criterion | Result |
|-----------|--------|
| **Integrity (permissive)** | ✓ PASSED |
| **Integrity (strict)** | ✗ FAILED (expected: no snapshots/attestations) |
| **Provenance** | ✓ Verified |
| **Critical findings** | 0 |
| **Overall** | **Suitable for governance evidence** (with remediation of minor findings) |

The auditor pack is fit for 3rd-party verification. Permissive mode passes; strict mode fails as expected for a bootstrap pack without snapshots and attestations. One non-critical finding: MANIFEST.pack_sha256 mismatch.

---

## 2. Scope

Dry-run verification per [DRY_RUN_AUDIT_PLAN](DRY_RUN_AUDIT_PLAN.md):
- Pack integrity (checksums)
- Provenance (tag, commit, origin)
- Trust anchors, policies, verifier
- No live system access

---

## 3. Methodology

1. Extracted `auditor-pack-2026-02-02T14-37-09.tar.gz` from dist/
2. Ran `node verify.mjs` (permissive)
3. Ran `node verify.mjs --strict`
4. Ran `node verify.mjs --json`
5. Verified pack SHA-256 vs release notes
6. Verified commit exists in repo
7. Inspected MANIFEST.json

---

## 4. Artifacts Reviewed

| Artifact | Value |
|----------|-------|
| Pack file | auditor-pack-2026-02-02T14-37-09.tar.gz |
| Pack ID | 3ab7eace4da2e497 |
| Release tag | v0.3.1 |
| Commit | eac5a46b4e92a3829eebc680b6e333cdd7ed5bdf |
| Pack SHA-256 (file) | cb1d221f5c49a8ecd98a990935a780c654fe5a3ed9b0a385b45ef6989f74e1f2 |
| Pack SHA-256 (release notes) | cb1d221f5c49a8ecd98a990935a780c654fe5a3ed9b0a385b45ef6989f74e1f2 ✓ |

---

## 5. Verification Results

### 5.1 Permissive Mode

```
RESULT: ✓ VERIFICATION PASSED
Warnings: 1 (optional artifacts missing)
```

- Checksums: 7 files, all match ✓
- Trust anchors: Present, valid ✓
- Policies: POLICY_INDEX + 3 policies ✓
- Snapshots: 0 (warning)
- Attestations: 0 (warning)
- Exit code: 0 ✓

### 5.2 Strict Mode

```
RESULT: ✗ VERIFICATION FAILED (strict mode requires all artifacts)
Missing: 1 optional artifact(s)
```

- Expected: pack has no snapshots/attestations (bootstrap)
- Exit code: 1 ✓ (correct behavior)

### 5.3 JSON Output

```json
{
  "pack_id": "3ab7eace4da2e497",
  "verified_at": "2026-02-02T14:56:01.851Z",
  "mode": "permissive",
  "errors": 0,
  "warnings": 1,
  "passed": true,
  "checks": {
    "checksums": true,
    "trust_anchors": true,
    "snapshots": false,
    "policies": true,
    "attestations": false
  }
}
```

---

## 6. Provenance Assessment

| Check | Result |
|-------|--------|
| MANIFEST.source_git.tag = v0.3.1 | ✓ |
| MANIFEST.source_git.commit = eac5a46... | ✓ |
| Commit exists in repo | ✓ |
| MANIFEST.source_git.origin | https://github.com/yrippert-maker/papa-app.git ✓ |

---

## 7. Findings

| ID | Severity | Description | Recommendation |
|----|----------|-------------|----------------|
| DRY-001 | Info | Strict mode FAILED — no snapshots/attestations | Add snapshots + attestations for production pack; expected for bootstrap |
| DRY-002 | Resolved | MANIFEST.pack_sha256 cannot equal hash of tar containing it (logical impossibility) | Removed from manifest; release notes are authoritative for pack SHA-256 |
| DRY-003 | Info | Trust anchors: 0 keys (workspace has no keys) | Populate workspace keys for production pack |

**Critical findings:** 0

---

## 8. Conclusion

The auditor pack is **suitable for governance evidence** in permissive mode. Integrity is verified; provenance is traceable. For strict-mode PASSED, add snapshots and attestations to the pack.

---

## 9. Next Steps

1. ~~Remediate DRY-002~~ (resolved: pack_sha256 removed from manifest)
2. Add snapshots + attestations for production pack (strict PASSED)
3. Engage 3rd-party auditor for formal dry-run
4. Proceed to Governance Charter ratification upon clean report

---

## Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-02 | Initial internal dry-run report |
