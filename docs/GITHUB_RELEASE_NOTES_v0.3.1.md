# Release v0.3.1 — Independent Verifier Pack

**Release Date:** 2026-02-02  
**Tag:** `v0.3.1`

---

## Overview

This release introduces the **Independent Verifier Pack** — a self-contained, audit-grade package that external auditors can download and verify with a single command, without any environment setup or npm dependencies.

### Audit-Grade Features

- **Deterministic manifest** with full provenance (git commit, tag, origin)
- **SHA-256 checksums** for all files including the pack itself
- **Strict mode** for production audits (`--strict` requires all artifacts)
- **JSON output** for CI/automation (`--json`)
- **Offline capable** — no network access required

---

## What's New

### 🔍 Independent Verifier Pack

A complete, portable verification bundle for external auditors:

```bash
# Generate the pack
npm run auditor-pack:create

# Auditor verification (in extracted pack)
node verify.mjs
```

### Pack Contents

| File | Description |
|------|-------------|
| `MANIFEST.json` | Pack metadata with full provenance |
| `trust-anchors.json` | Public keys for signature verification |
| `verify.mjs` | Standalone verifier (no deps) |
| `VERIFY.md` | Clear verification semantics |
| `attestations/` | Latest signed compliance statements |
| `snapshots/` | Audit snapshots with hash chain |
| `policies/` | Governance policy definitions |

### MANIFEST.json Structure

```json
{
  "pack_version": "1.0.0",
  "pack_id": "abc123...",
  "created_at": "2026-02-02T14:32:24Z",
  "organization": "Papa App Inc.",
  "source_git": {
    "tag": "v0.3.1",
    "commit": "abc123def456...",
    "branch": "main",
    "dirty": false,
    "origin": "https://github.com/..."
  },
  "files": [
    { "path": "...", "sha256": "...", "size": 1234 }
  ],
  "trust_anchor_fingerprints": [...],
  "policy_index_sha256": "...",
  "verifier_sha256": "..."
}
```

*Pack SHA-256 is published in release notes (authoritative for pack integrity).*

### Verification Modes

| Mode | Command | Behavior |
|------|---------|----------|
| Permissive | `node verify.mjs` | PASSED if checksums OK, warns on missing artifacts |
| Strict | `node verify.mjs --strict` | FAILED if any artifacts missing |
| Verbose | `node verify.mjs --verbose` | Detailed per-file output |
| JSON | `node verify.mjs --json` | Machine-readable for CI |

### Verification Semantics

| Result | Meaning |
|--------|---------|
| ✓ **PASSED** | Package integrity verified, trust anchors validated |
| ⚠ **WARN** | Optional evidence artifacts missing |
| ✗ **FAILED** | Checksum mismatch, signature invalid, or chain broken |

---

## Verification Output

```
═══════════════════════════════════════════════════════════
  INDEPENDENT AUDITOR VERIFICATION
═══════════════════════════════════════════════════════════

Pack ID: abc123def456
Created: 2026-02-02T14:30:00Z
Organization: Papa App

1. FILE CHECKSUMS
----------------------------------------
  • 15 files checked

2. TRUST ANCHORS
----------------------------------------
  ✓ Organization: Papa App
  ✓ Keys: 2
  • Active: 1, Archived: 1

3. AUDIT SNAPSHOTS
----------------------------------------
  • 10 snapshots checked
  ✓ Hash chain: VALID

4. GOVERNANCE POLICIES
----------------------------------------
  ✓ Index version: 1.0.0
  • Policies: 3

5. ATTESTATIONS
----------------------------------------
  • 2 attestations checked

═══════════════════════════════════════════════════════════
  RESULT: ✓ VERIFICATION PASSED
═══════════════════════════════════════════════════════════
```

---

## Usage

### Generate Pack

```bash
# Default output to ./dist/
npm run auditor-pack:create

# Custom organization name
npm run auditor-pack:create -- --org "Your Company"

# Custom output directory
npm run auditor-pack:create -- --output /path/to/output
```

### Verify Pack (as Auditor)

```bash
# Extract
tar -xzf auditor-pack-2026-02-02T14-30-00.tar.gz

# Verify
cd auditor-pack-2026-02-02T14-30-00
node verify.mjs

# Verbose output
node verify.mjs --verbose
```

---

## New Files

| File | Description |
|------|-------------|
| `scripts/create-auditor-pack.mjs` | Pack generator |

---

## New npm Script

| Script | Description |
|--------|-------------|
| `auditor-pack:create` | Generate independent verifier pack |

---

## Compliance Benefits

- **SOC 2 CC7.1** — Evidence of independent verification capability
- **ISO 27001 A.18.2.1** — Compliance assessment support
- **Regulatory** — Self-service audit artifact delivery

---

## Upgrade Notes

No breaking changes. Simply run `npm run auditor-pack:create` to generate a pack.

---

## Next Steps (v0.4.0)

- Dockerized verifier (no Node.js required)
- CI/CD integration for automatic pack generation
- Pack signing with organizational key
