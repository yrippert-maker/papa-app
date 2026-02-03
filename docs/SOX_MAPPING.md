# SOX 404 — IT General Controls Mapping

**Scope:** Auditor pack, anchoring governance, verification contour  
**Status:** Reference mapping for external audit

---

## ITGC-1: Data Integrity

**Implemented**

- Canonical pack hashing (`pack_hash.json`)
- Cryptographic signature (Ed25519)
- Manifest-based integrity validation

**Evidence**

- Auditor pack
- `independent-verify` output
- CI verify logs

---

## ITGC-2: Change Detection

**Implemented**

- Any data change → hash mismatch
- Signature invalidation
- CI hard-fail on critical issues

**Evidence**

- CI failures
- `verify` exit code = 2

---

## ITGC-3: Access & Release Control

**Implemented**

- Release gated by verification
- No manual override in CI

**Evidence**

- `.github/workflows/ci.yml` (job `verify_audit`)
- `.github/workflows/audit-monitor.yml`

---

## Conclusion

> The control design provides reasonable assurance that financial-domain data is complete, accurate, and protected against unauthorized modification.
