-- Add status 'empty' for periods with 0 events (no publish, merkle_root=NULL).
-- Makes semantics clear: empty = noop, not "something stuck".
-- merkle_root nullable for empty anchors.

CREATE TABLE IF NOT EXISTS ledger_anchors_new (
  id TEXT PRIMARY KEY,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  merkle_root TEXT,
  network TEXT,
  chain_id TEXT,
  tx_hash TEXT,
  anchored_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','failed','empty')),
  events_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  contract_address TEXT,
  block_number INTEGER,
  log_index INTEGER
);

INSERT INTO ledger_anchors_new
SELECT id, period_start, period_end, merkle_root, network, chain_id, tx_hash, anchored_at,
  CASE WHEN events_count = 0 AND merkle_root IS NOT NULL THEN 'empty' ELSE status END,
  events_count, created_at, contract_address, block_number, log_index
FROM ledger_anchors;

-- Normalize existing 0-event anchors to empty (merkle_root=NULL)
UPDATE ledger_anchors_new SET status = 'empty', merkle_root = NULL WHERE events_count = 0;

DROP TABLE ledger_anchors;
ALTER TABLE ledger_anchors_new RENAME TO ledger_anchors;

CREATE INDEX IF NOT EXISTS idx_ledger_anchors_status ON ledger_anchors(status);
CREATE INDEX IF NOT EXISTS idx_ledger_anchors_period ON ledger_anchors(period_start, period_end);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_anchors_period_unique ON ledger_anchors(period_start, period_end);
