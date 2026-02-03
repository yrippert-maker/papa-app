-- US-1: users table, new permissions, AUDITOR role
-- Up migration (requires 000_bootstrap)

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role_code TEXT NOT NULL REFERENCES rbac_role(role_code) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_code);

-- New permissions for API (workspace, files, ledger, admin)
INSERT OR IGNORE INTO rbac_permission(perm_code, perm_name, description) VALUES
('WORKSPACE.READ','Просмотр workspace','Статус, список файлов'),
('FILES.LIST','Список файлов','Просмотр файлов workspace'),
('FILES.UPLOAD','Загрузка файлов','Загрузка в AI inbox'),
('LEDGER.READ','Просмотр ledger','Чтение событий'),
('LEDGER.APPEND','Добавление в ledger','Запись событий'),
('ADMIN.MANAGE_USERS','Управление пользователями','Создание, роли, сброс паролей');

-- AUDITOR role (read-only)
INSERT OR IGNORE INTO rbac_role(role_code, role_name, description) VALUES
('AUDITOR','Аудитор','Только просмотр');

-- Assign new permissions to roles
INSERT OR IGNORE INTO rbac_role_permission(role_code, perm_code) VALUES
('ADMIN','WORKSPACE.READ'),
('ADMIN','FILES.LIST'),
('ADMIN','FILES.UPLOAD'),
('ADMIN','LEDGER.READ'),
('ADMIN','LEDGER.APPEND'),
('ADMIN','ADMIN.MANAGE_USERS'),
('MANAGER','WORKSPACE.READ'),
('MANAGER','FILES.LIST'),
('MANAGER','FILES.UPLOAD'),
('MANAGER','LEDGER.READ'),
('STOREKEEPER','WORKSPACE.READ'),
('STOREKEEPER','FILES.LIST'),
('STOREKEEPER','FILES.UPLOAD'),
('STOREKEEPER','LEDGER.READ'),
('ENGINEER','WORKSPACE.READ'),
('ENGINEER','FILES.LIST'),
('ENGINEER','LEDGER.READ'),
('AUDITOR','WORKSPACE.READ'),
('AUDITOR','FILES.LIST'),
('AUDITOR','LEDGER.READ');
