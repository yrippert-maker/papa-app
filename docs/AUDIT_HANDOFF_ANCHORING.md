# Audit Hand-off — Anchoring Governance (Copy UX & Verification)

## Scope

This hand-off covers the **anchoring governance verification pipeline**, including:

* anchoring issues detection,
* receipt integrity checks,
* independent (offline) verification,
* CI release gating,
* and operator runbooks.

The scope explicitly includes **UI diagnostics**, **auditor pack generation**, and **strict verification policies**.

---

## Delivered Artifacts

### 1) Auditor Pack (immutable snapshot)

The auditor pack contains all data required for offline verification.

**Contents:**

* `anchors.json` — `{ generated_at, anchors: [...] }`  
  Each anchor includes: `id, period_start, period_end, status, created_at, tx_hash`
* `onchain/receipts/<tx_hash>.json` — Raw on-chain receipts (one file per transaction, normalized hex)
* `onchain/receipts/receipts_manifest.json` — `{ generated_at, receipts: { "<tx_hash>": "<sha256>" } }`
* `ANCHORING_STATUS.json` — Aggregated anchoring status summary
* `ANCHORING_ISSUES.json` — Full list of detected anchoring issues
* `README_AUDIT.md` — Description of pack contents, data flow, trust assumptions, and verification steps

---

## Verification Model

### What is verified

* Existence of receipts for confirmed anchors
* SHA-256 integrity of each receipt against `receipts_manifest.json`
* Anchoring consistency:
  * failed anchors
  * pending anchors older than 72h
  * receipt missing / receipt mismatch
  * optional gaps between anchoring periods
* Deterministic issue classification with severity levels

### What is not verified

* Live blockchain state (verification is offline by design)
* External RPC availability
* Consensus validity beyond stored receipts

---

## Independent Verification (Offline)

Verification can be executed **without running the application**.

### Command

```bash
STRICT_VERIFY=1 \
REQUIRE_ANCHORING_ISSUES=1 \
VERIFY_FAIL_SEVERITY=critical \
VERIFY_FAIL_TYPES=RECEIPT_INTEGRITY_MISMATCH,RECEIPT_MISSING_FOR_CONFIRMED,ANCHOR_FAILED \
node scripts/independent-verify.mjs --audit-pack <PATH_TO_PACK>
```

### Behaviour

* Reads `ANCHORING_ISSUES.json` and `ANCHORING_STATUS.json`
* Fails verification if:
  * required files are missing
  * any issue matches configured fail severity or fail types
* Exit codes:
  * `0` — verification passed
  * `2` — verification failed (policy violation)

---

## CI / Release Gate

* A dedicated CI job `verify_audit` runs on:
  * `main` branch
  * tag pushes
* The job:
  1. Builds the project
  2. Generates the auditor pack
  3. Runs **independent verification in strict mode**
* Any verification failure **blocks the release**
* CI stores:
  * verification output (`verify-output`)
  * machine-readable summary (`verify-summary`)
  * auditor pack (`auditor-pack`)

---

## Operational Checks

A step-by-step operator checklist is provided in:

```
docs/OPS_AUDIT_CHECKLIST_ANCHORING.md
```

Includes:

* **C1**: Ops smoke test (~5 minutes)
* **C2**: Full audit readiness (~15 minutes)

---

## UI Diagnostics (Non-authoritative)

The governance UI provides real-time visibility into anchoring issues:

* Severity-based highlighting
* Copy diagnostics (tx hash, anchor ID, deep link)
* Client-side filtering and search

> UI is informational only. **Audit decisions rely exclusively on the auditor pack and independent verification.**

---

## Trust Assumptions

* Auditor pack is treated as immutable once generated
* Receipt integrity is anchored via SHA-256 manifest
* Verification results are deterministic given the same pack

---

## References

* Auditor Pack: CI artifact `auditor-pack`, or `dist/auditor-pack-*`
* CI Job: `verify_audit`
* Scripts:
  * `scripts/generate-anchoring-issues.mjs`
  * `scripts/independent-verify.mjs`
* Documentation:
  * `README_AUDIT.md` (inside pack)
  * `docs/OPS_AUDIT_CHECKLIST_ANCHORING.md`

---

**Status:** Delivered, audit-ready, release-gated.
