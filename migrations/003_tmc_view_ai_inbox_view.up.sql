-- PR-2: TMC.VIEW (read-only TMC), AI_INBOX.VIEW (view inbox without upload)
-- Roles: TMC.VIEW → ADMIN, AUDITOR, ENGINEER, STOREKEEPER, MANAGER
--       AI_INBOX.VIEW → ADMIN, AUDITOR, MANAGER

INSERT OR IGNORE INTO rbac_permission(perm_code, perm_name, description) VALUES
('TMC.VIEW','Просмотр ТМЦ','Просмотр реестра и лотов без изменения'),
('AI_INBOX.VIEW','Просмотр AI Inbox','Просмотр папки ai-inbox без загрузки');

-- TMC.VIEW: read-only roles
INSERT OR IGNORE INTO rbac_role_permission(role_code, perm_code) VALUES
('ADMIN','TMC.VIEW'),
('AUDITOR','TMC.VIEW'),
('ENGINEER','TMC.VIEW'),
('STOREKEEPER','TMC.VIEW'),
('MANAGER','TMC.VIEW');

-- AI_INBOX.VIEW
INSERT OR IGNORE INTO rbac_role_permission(role_code, perm_code) VALUES
('ADMIN','AI_INBOX.VIEW'),
('AUDITOR','AI_INBOX.VIEW'),
('MANAGER','AI_INBOX.VIEW');
