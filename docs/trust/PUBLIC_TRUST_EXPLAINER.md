# Public Trust Explainer

## What this system is
This program produces **tamper-evident audit evidence** for key operational and compliance flows (verification results, policy/config changes, and automated mail-to-doc updates).

We do not ask you to trust the process — we provide **artifacts that can be independently verified**.

## Core idea (plain language)
1) Every run produces an evidence record (a "ledger entry").
2) Each day's entries are summarized into a "daily rollup" using a Merkle root.
3) The daily rollup can be anchored to a public network (optional), proving the day's evidence existed at that time.
4) Exceptions are time-bounded (TTL) and visible in an exception register.

## What cannot be changed unnoticed
- Evidence entries are **append-only**.
- Daily rollups bind all entries for that day into a single fingerprint (Merkle root).
- If any stored evidence is altered, the Merkle root changes and verification fails.

## What an auditor can do
- Download an immutable pack archive and re-run independent verification.
- Review daily rollups and verify the Merkle root integrity.
- Check configuration change audit trail (who/when/what) for allowlists and policies.
- Review time-bounded exceptions (acknowledgements) and their expiry.

## What artifacts exist
- **Ledger entries** (JSON): verifications, mail events, document changes, configuration changes.
- **Daily rollup** (JSON): counts + Merkle root + manifest.
- **Anchoring status** (JSON, optional): proof of anchoring a rollup to a public network.
- **Pack archives** (tar.gz): immutable bundles for reproducible verification.

## One-sentence summary
**We provide immutable evidence artifacts, daily cryptographic rollups, and optional public anchoring so independent parties can verify integrity without trusting internal systems.**
