-- DB-level last-admin invariant: нельзя удалить или понизить последнего ADMIN/OWNER.
-- PostgreSQL: функция + триггеры BEFORE UPDATE/DELETE.

CREATE OR REPLACE FUNCTION check_last_admin()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.role_code IN ('ADMIN','OWNER') AND (NEW.role_code IS NULL OR NEW.role_code NOT IN ('ADMIN','OWNER')) THEN
      IF (SELECT COUNT(*) FROM users WHERE role_code IN ('ADMIN','OWNER') AND id != OLD.id) = 0 THEN
        RAISE EXCEPTION 'Cannot remove last admin: at least one ADMIN or OWNER must exist';
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.role_code IN ('ADMIN','OWNER') THEN
      IF (SELECT COUNT(*) FROM users WHERE role_code IN ('ADMIN','OWNER') AND id != OLD.id) = 0 THEN
        RAISE EXCEPTION 'Cannot remove last admin: at least one ADMIN or OWNER must exist';
      END IF;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_last_admin_update ON users;
CREATE TRIGGER prevent_last_admin_update
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE PROCEDURE check_last_admin();

DROP TRIGGER IF EXISTS prevent_last_admin_delete ON users;
CREATE TRIGGER prevent_last_admin_delete
  BEFORE DELETE ON users
  FOR EACH ROW
  EXECUTE PROCEDURE check_last_admin();
