# Anchoring Verification — External Audit Note

*(UI-agnostic, for external auditors)*

## Overview

Anchoring verification is performed using immutable data snapshots (“auditor packs”) and offline verification tooling. No access to live systems or application UI is required.

## Verification Inputs

* Anchoring records (`anchors.json`)
* On-chain receipts
* Receipt hash manifest
* Derived issue and status summaries

## Verification Process

* Receipt files are hashed (SHA-256) and compared against the manifest.
* Anchoring records are checked for lifecycle consistency.
* All detected issues are classified deterministically.

## Independence

* Verification is executable on any machine with Node.js.
* Results are reproducible given the same auditor pack.

## Failure Policy

Verification fails if:

* required inputs are missing,
* receipt integrity mismatches are found,
* critical issues are present.

## Outputs

* Human-readable verification log
* Machine-readable issue summaries (`verify-summary.json`)
* Explicit pass/fail exit code

## Conclusion

The verification process provides sufficient evidence to assess anchoring integrity without reliance on application runtime behavior.
