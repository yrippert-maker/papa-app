-- US-1: Rollback users table
-- Down migration (destructive - use with care)

DROP TABLE IF EXISTS users;

-- Remove AUDITOR role and new permissions (simplified - does not remove role_permission for new perms)
DELETE FROM rbac_role_permission WHERE perm_code IN ('WORKSPACE.READ','FILES.LIST','FILES.UPLOAD','LEDGER.READ','LEDGER.APPEND','ADMIN.MANAGE_USERS');
DELETE FROM rbac_role WHERE role_code = 'AUDITOR';
DELETE FROM rbac_permission WHERE perm_code IN ('WORKSPACE.READ','FILES.LIST','FILES.UPLOAD','LEDGER.READ','LEDGER.APPEND','ADMIN.MANAGE_USERS');
