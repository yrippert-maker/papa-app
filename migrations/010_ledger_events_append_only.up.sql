-- Hardening: ledger_events is append-only. Forbid UPDATE/DELETE at DB level.
CREATE TRIGGER IF NOT EXISTS ledger_events_no_update
  BEFORE UPDATE ON ledger_events
  BEGIN
    SELECT RAISE(ABORT, 'ledger_events is append-only: UPDATE not allowed');
  END;

CREATE TRIGGER IF NOT EXISTS ledger_events_no_delete
  BEFORE DELETE ON ledger_events
  BEGIN
    SELECT RAISE(ABORT, 'ledger_events is append-only: DELETE not allowed');
  END;
