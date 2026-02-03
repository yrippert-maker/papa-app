-- Rollback TMC.VIEW and AI_INBOX.VIEW
DELETE FROM rbac_role_permission WHERE perm_code IN ('TMC.VIEW','AI_INBOX.VIEW');
DELETE FROM rbac_permission WHERE perm_code IN ('TMC.VIEW','AI_INBOX.VIEW');
