-- Bootstrap: minimal schema for migrations (rbac)
-- Full schema is in lib/db.ts; this allows migrate to run on empty DB

CREATE TABLE IF NOT EXISTS rbac_permission (
  perm_code TEXT PRIMARY KEY,
  perm_name TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS rbac_role (
  role_code TEXT PRIMARY KEY,
  role_name TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS rbac_role_permission (
  role_code TEXT NOT NULL REFERENCES rbac_role(role_code) ON DELETE CASCADE,
  perm_code TEXT NOT NULL REFERENCES rbac_permission(perm_code) ON DELETE CASCADE,
  PRIMARY KEY (role_code, perm_code)
);

INSERT OR IGNORE INTO rbac_role(role_code, role_name, description) VALUES
('ADMIN','Администратор','Полный доступ'),
('MANAGER','Менеджер','Управленческий доступ'),
('STOREKEEPER','Кладовщик','Доступ к складу'),
('ENGINEER','Инженер','Инженерный доступ');
