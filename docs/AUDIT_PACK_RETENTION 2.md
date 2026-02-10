# Auditor Pack Retention Policy

**Scope:** Daily/scheduled auditor packs, evidence index, CI artifacts, evidence ledger.

## Policy (recommended)

- **Retention:** Keep auditor packs for **N days** (e.g. 90).
- **Storage:** S3/GCS or GitHub Actions artifacts (artifacts expire per repo settings).
- **Index:** `evidence-index.json` (when present) can include a `retention` field for downstream automation.

## CI artifacts

- `verify-output` and `auditor-pack` are uploaded on main/tags.
- Configure artifact retention in **Settings → Actions → General → Artifact and log retention**.

## Daily monitor

- `audit-monitor` workflow produces one pack per run.
- For long-term retention, add a step to upload the pack to S3/GCS and maintain an index (e.g. append-only JSONL: pack_id, pack_sha256, generated_at, verification_result).

## Evidence ledger retention

In addition to storing full auditor packs, we publish a small append-only **ledger-entry.json** for each pack to durable object storage (S3/GCS).

**Recommended minimum:**

- Keep ledger entries for **≥ 180 days** (often 365+ for auditability).
- Enable **bucket versioning** (required).
- If available, enable **object lock / retention policy** for stronger immutability guarantees.

### Object layout (default)

`ledger/YYYY/MM/DD/<pack_sha256>.json`

(When `pack_sha256` is absent, `fingerprint_sha256` of the entry is used as the object key.)

### What a ledger entry contains

- pack sha256, signature status + key_id
- policy (loaded_from, fail/warn settings)
- anchoring status + issue counters
- CI provenance (repo, commit, run_url) when available
- fingerprint_sha256 (hash of the entry for tamper-evidence)

### Operational notes

- Ledger entries are small and cheap; they are your long-term “paper trail”.
- Full packs can have shorter retention; ledger should be longer.
- Configure `vars.LEDGER_BUCKET` and AWS credentials (or GCS auth) to enable publishing; if unset, the pipeline skips ledger publish.

## Daily ledger rollups (Merkle)

We compute a daily Merkle root over all ledger entries for the UTC day:

`ledger-rollups/YYYY/MM/DD/rollup.json`

This enables tamper-evidence:

- if any historical ledger entry changes, the Merkle root changes
- the Merkle root can be anchored (recommended) using the existing anchoring mechanism

### Recommended retention

- Keep rollups ≥ ledger retention (often 365+ days).

## Config ledger `_pending` (atomic-ish allowlist save)

- **`doc-ledger/_pending/`** — temporary zone for prepare-phase ledger entries; config change is committed only after a durable ledger write.
- **Rollup** ignores `_pending` (only `doc-ledger/YYYY/MM/DD/*.json` are included in the daily Merkle root).
- **GC:** Run `npm run ledger:pending:gc` (or the `pending-gc` workflow) to delete pending objects older than N hours (default 24). This prevents `_pending` from growing indefinitely if finalize or delete fails. Supports `--backend s3|gcs` (same as ledger-rollup); GCS auth via ADC (e.g. `GOOGLE_APPLICATION_CREDENTIALS` or Workload Identity in CI).
