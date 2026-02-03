-- Revert to original schema (status without 'empty', merkle_root NOT NULL).
-- Note: anchors with status='empty' will become 'pending'; merkle_root restored from hash of ''.

CREATE TABLE IF NOT EXISTS ledger_anchors_old (
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
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  contract_address TEXT,
  block_number INTEGER,
  log_index INTEGER
);

INSERT INTO ledger_anchors_old
SELECT id, period_start, period_end,
  COALESCE(merkle_root, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'),
  network, chain_id, tx_hash, anchored_at,
  CASE WHEN status = 'empty' THEN 'pending' ELSE status END,
  events_count, created_at, contract_address, block_number, log_index
FROM ledger_anchors;

DROP TABLE ledger_anchors;
ALTER TABLE ledger_anchors_old RENAME TO ledger_anchors;

CREATE INDEX IF NOT EXISTS idx_ledger_anchors_status ON ledger_anchors(status);
CREATE INDEX IF NOT EXISTS idx_ledger_anchors_period ON ledger_anchors(period_start, period_end);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_anchors_period_unique ON ledger_anchors(period_start, period_end);
