-- On-chain fields for ledger_anchors (Polygon)
ALTER TABLE ledger_anchors ADD COLUMN contract_address TEXT;
ALTER TABLE ledger_anchors ADD COLUMN block_number INTEGER;
ALTER TABLE ledger_anchors ADD COLUMN log_index INTEGER;

-- Unique period per network (idempotency)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_anchors_period_unique
  ON ledger_anchors(period_start, period_end);
