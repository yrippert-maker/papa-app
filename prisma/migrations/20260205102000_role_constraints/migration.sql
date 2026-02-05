-- Role invariants: only allowed role names
-- Prevents accidental creation of unknown roles
ALTER TABLE "Role"
ADD CONSTRAINT role_name_allowed
CHECK (name IN ('admin', 'user', 'auditor'));
