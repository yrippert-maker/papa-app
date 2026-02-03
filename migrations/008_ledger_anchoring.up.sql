-- Ledger Anchoring (Variant B): artifact refs, signatures, anchors
-- Extends ledger_events; creates ledger_anchors for Merkle root anchoring

-- Add anchoring columns to ledger_events (nullable for backward compat)
ALTER TABLE ledger_events ADD COLUMN artifact_sha256 TEXT;
ALTER TABLE ledger_events ADD COLUMN artifact_ref TEXT;
ALTER TABLE ledger_events ADD COLUMN payload_c14n_sha256 TEXT;
ALTER TABLE ledger_events ADD COLUMN signature TEXT;
ALTER TABLE ledger_events ADD COLUMN key_id TEXT;
ALTER TABLE ledger_events ADD COLUMN anchor_id TEXT;

CREATE INDEX IF NOT EXISTS idx_ledger_events_artifact_sha256 ON ledger_events(artifact_sha256);
CREATE INDEX IF NOT EXISTS idx_ledger_events_anchor_id ON ledger_events(anchor_id);

-- ledger_anchors: Merkle root per period, on-chain tx
CREATE TABLE IF NOT EXISTS ledger_anchors (
  id TEXT PRIMARY KEY,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  merkle_root TEXT NOT NULL,
  network TEXT,
  chain_id TEXT,
  tx_hash TEXT,
  anchored_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','failed')),
  events_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ledger_anchors_status ON ledger_anchors(status);
CREATE INDEX IF NOT EXISTS idx_ledger_anchors_period ON ledger_anchors(period_start, period_end);
