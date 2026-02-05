-- DB-level last-admin invariant: нельзя удалить или понизить последнего ADMIN/OWNER.
-- SQLite: триггеры BEFORE UPDATE/DELETE.

CREATE TRIGGER IF NOT EXISTS prevent_last_admin_update
BEFORE UPDATE ON users
FOR EACH ROW
WHEN (
  OLD.role_code IN ('ADMIN','OWNER')
  AND (NEW.role_code IS NULL OR NEW.role_code NOT IN ('ADMIN','OWNER'))
)
BEGIN
  SELECT CASE
    WHEN (SELECT COUNT(*) FROM users WHERE role_code IN ('ADMIN','OWNER') AND id != OLD.id) = 0
    THEN RAISE(ABORT, 'Cannot remove last admin: at least one ADMIN or OWNER must exist')
  END;
END;

CREATE TRIGGER IF NOT EXISTS prevent_last_admin_delete
BEFORE DELETE ON users
FOR EACH ROW
WHEN (OLD.role_code IN ('ADMIN','OWNER'))
BEGIN
  SELECT CASE
    WHEN (SELECT COUNT(*) FROM users WHERE role_code IN ('ADMIN','OWNER') AND id != OLD.id) = 0
    THEN RAISE(ABORT, 'Cannot remove last admin: at least one ADMIN or OWNER must exist')
  END;
END;
