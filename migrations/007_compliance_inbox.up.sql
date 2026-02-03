-- Compliance Inbox: Change Events, Patch Proposals, Decisions, Revisions
-- Accept → Proposal; Apply → реальные правки в DOCX (manual only)

CREATE TABLE IF NOT EXISTS compliance_change_event (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  published_at TEXT,
  url TEXT,
  artifact_sha256 TEXT,
  summary TEXT,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','minor','major','critical')),
  tags TEXT,
  fulltext_path TEXT,
  diff_summary TEXT,
  status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW','ACCEPTED','PROPOSED','APPLIED','REJECTED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_compliance_event_status ON compliance_change_event(status, created_at DESC);
CREATE INDEX idx_compliance_event_source ON compliance_change_event(source);

CREATE TABLE IF NOT EXISTS compliance_patch_proposal (
  id TEXT PRIMARY KEY,
  change_event_id TEXT NOT NULL REFERENCES compliance_change_event(id) ON DELETE CASCADE,
  apply_mode TEXT NOT NULL DEFAULT 'manual' CHECK (apply_mode IN ('auto','minors_only','manual')),
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','applied','superseded')),
  targets_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  applied_at TEXT,
  applied_by TEXT
);

CREATE INDEX idx_compliance_proposal_event ON compliance_patch_proposal(change_event_id);

CREATE TABLE IF NOT EXISTS compliance_decision_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  change_event_id TEXT NOT NULL REFERENCES compliance_change_event(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('accept','reject')),
  actor_user_id TEXT,
  actor_role TEXT,
  comment TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_compliance_decision_event ON compliance_decision_log(change_event_id);

CREATE TABLE IF NOT EXISTS compliance_revision (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL REFERENCES compliance_patch_proposal(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL,
  section_id TEXT,
  before_sha256 TEXT,
  after_sha256 TEXT,
  before_path TEXT,
  after_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_compliance_revision_proposal ON compliance_revision(proposal_id);
