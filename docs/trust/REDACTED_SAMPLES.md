# Redacted Samples (Ledger / Rollup / Anchor)

This document describes **where to find** and **what to redact** when sharing sample artifacts with external parties (auditor, bank, investor). The goal is to demonstrate structure and integrity without exposing sensitive data.

## What cannot be changed unnoticed

- **Ledger entries** are append-only; any edit changes the object hash and breaks the chain.
- **Daily rollups** bind all entries for that day into a single Merkle root; altering any entry invalidates the root.
- **Anchoring** proves that the Merkle root existed at a given time on a public network; the proof is verifiable independently.

## Ledger entry (redacted sample)

**Location:** `ledger/YYYY/MM/DD/<sha256>.json` or `doc-ledger/YYYY/MM/DD/<key>.json`, `mail-ledger/...`

**Redact before sharing:**

- Internal IDs (mailbox, user ids) → replace with `REDACTED` or `***`
- PII in payload (names, emails in body) → mask or remove
- Keep: `event_type`, `created_at`, structure of `payload` (keys only or hashed values), `prev_hash` / `block_hash` for chain verification

**Example shape (redacted):**

```json
{
  "event_type": "config_change",
  "created_at": "2026-02-02T12:00:00Z",
  "payload": { "action": "allowlist_update", "actor_id": "REDACTED" },
  "prev_hash": "abc...",
  "block_hash": "def..."
}
```

## Rollup (redacted sample)

**Location:** `ledger-rollups/YYYY/MM/DD/rollup.json`, `manifest.json`

**Redact:** Entry keys or paths that reveal internal structure; keep `merkle_root`, `count`, `date`, `entries` as list of keys (or hashes only).

**Example shape:**

```json
{
  "date": "2026-02-02",
  "merkle_root": "<hex>",
  "entries": { "count": 42, "keys": ["ledger/...", "doc-ledger/..."] }
}
```

## Anchor (redacted sample)

**Location:** `ledger-rollups/YYYY/MM/DD/ROLLUP_ANCHORING_STATUS.json`

**Redact:** Internal tx metadata if any; keep `network`, `tx_hash` (or equivalent), `merkle_root`, `anchored_at` so a third party can verify on-chain.

## Suggested delivery

- One **ledger entry** sample (redacted).
- One **rollup** sample (redacted).
- One **anchor** sample (if anchoring is enabled).

Provide these alongside [PUBLIC_TRUST_EXPLAINER.md](./PUBLIC_TRUST_EXPLAINER.md) and [BANK_INVESTOR_PACKET.md](../compliance/BANK_INVESTOR_PACKET.md).
