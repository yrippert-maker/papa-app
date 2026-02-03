-- SQLite does not support DROP COLUMN easily; we leave columns (no-op)
DROP INDEX IF EXISTS idx_ledger_events_artifact_sha256;
DROP INDEX IF EXISTS idx_ledger_events_anchor_id;
DROP TABLE IF EXISTS ledger_anchors;
