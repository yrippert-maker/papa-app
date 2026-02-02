-- Key lifecycle requests for 2-man rule approval flow
CREATE TABLE IF NOT EXISTS key_lifecycle_requests (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL CHECK (action IN ('ROTATE', 'REVOKE')),
  target_key_id TEXT,
  reason TEXT,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'EXECUTED')) DEFAULT 'PENDING',
  initiator_id TEXT NOT NULL,
  initiator_signature TEXT,
  approver_id TEXT,
  approver_signature TEXT,
  rejection_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  approved_at TEXT,
  rejected_at TEXT,
  executed_at TEXT,
  expires_at TEXT NOT NULL,
  execution_result TEXT,
  ledger_block_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_key_lifecycle_requests_status ON key_lifecycle_requests(status);
CREATE INDEX IF NOT EXISTS idx_key_lifecycle_requests_initiator ON key_lifecycle_requests(initiator_id);
CREATE INDEX IF NOT EXISTS idx_key_lifecycle_requests_expires ON key_lifecycle_requests(expires_at);
