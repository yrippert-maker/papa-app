import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { withRetry, SQLITE_BUSY } from './db/sqlite';
import { createSqliteAdapter } from './adapters/sqlite-adapter';
import type { DbAdapter } from './adapters/types';

export { withRetry, SQLITE_BUSY };

let db: DbAdapter | null = null;
let dbReadOnly: DbAdapter | null = null;

export function getDb(): DbAdapter {
  if (db) return db;
  db = createSqliteAdapter({ mode: 'readwrite' });

  // SQLite bootstrap schema (Postgres uses migrations)
  db.exec(`
    -- File Registry
    CREATE TABLE IF NOT EXISTS file_registry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      relative_path TEXT NOT NULL UNIQUE,
      checksum_sha256 TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      uploaded_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_file_registry_path ON file_registry(relative_path);

    -- Ledger Events (actor_id for hash attribution; ts_utc = created_at)
    CREATE TABLE IF NOT EXISTS ledger_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      prev_hash TEXT,
      block_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      actor_id TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_ledger_created ON ledger_events(created_at);

    -- TMC Registry (V2026_01_24_004)
    CREATE TABLE IF NOT EXISTS tmc_item (
      tmc_item_id TEXT PRIMARY KEY,
      item_code TEXT UNIQUE,
      name TEXT NOT NULL,
      unit TEXT NOT NULL DEFAULT 'pcs',
      category TEXT,
      description TEXT,
      manufacturer TEXT,
      part_no TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_tmc_item_name ON tmc_item(name);

    CREATE TABLE IF NOT EXISTS tmc_stock_lot (
      tmc_lot_id TEXT PRIMARY KEY,
      tmc_item_id TEXT NOT NULL REFERENCES tmc_item(tmc_item_id) ON DELETE RESTRICT,
      lot_no TEXT,
      serial_no TEXT,
      qty_received REAL NOT NULL DEFAULT 0,
      qty_on_hand REAL NOT NULL DEFAULT 0,
      location TEXT,
      received_at TEXT,
      supplier TEXT,
      incoming_request_id TEXT,
      outgoing_request_id TEXT,
      repair_case_id TEXT,
      status TEXT NOT NULL DEFAULT 'ON_HAND'
        CHECK (status IN ('ON_HAND','RESERVED','ISSUED','QUARANTINE','SCRAPPED')),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_tmc_stock_lot_item ON tmc_stock_lot(tmc_item_id, status);

    CREATE TABLE IF NOT EXISTS tmc_movement (
      tmc_movement_id TEXT PRIMARY KEY,
      occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
      movement_type TEXT NOT NULL
        CHECK (movement_type IN ('IN','OUT','TRANSFER','ADJUST','RESERVE','UNRESERVE')),
      tmc_lot_id TEXT NOT NULL REFERENCES tmc_stock_lot(tmc_lot_id) ON DELETE CASCADE,
      qty_delta REAL NOT NULL,
      from_location TEXT,
      to_location TEXT,
      actor_user_id TEXT,
      actor_role TEXT,
      reason TEXT,
      incoming_request_id TEXT,
      outgoing_request_id TEXT,
      repair_case_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_tmc_movement_lot_time ON tmc_movement(tmc_lot_id, occurred_at DESC);

    -- TMC Requests (V2026_01_24_006)
    CREATE TABLE IF NOT EXISTS tmc_request (
      tmc_request_id TEXT PRIMARY KEY,
      request_no TEXT UNIQUE,
      request_kind TEXT NOT NULL CHECK (request_kind IN ('INCOMING','OUTGOING')),
      request_category TEXT NOT NULL CHECK (request_category IN ('TECH_CARD','PURCHASE','TRANSFER','OTHER')),
      request_subcategory TEXT CHECK (request_subcategory IS NULL OR request_subcategory IN ('INPUT_CONTROL','OUTPUT_CONTROL')),
      status TEXT NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT','SUBMITTED','APPROVED','REJECTED','IN_PROGRESS','COMPLETED','CANCELLED')),
      title TEXT,
      description TEXT,
      asset_id TEXT,
      repair_case_id TEXT,
      supplier TEXT,
      customer TEXT,
      from_location TEXT,
      to_location TEXT,
      planned_at TEXT,
      due_at TEXT,
      created_by TEXT,
      created_role TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_tmc_request_kind_status ON tmc_request(request_kind, status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_tmc_request_asset_case ON tmc_request(asset_id, repair_case_id);

    CREATE TABLE IF NOT EXISTS tmc_request_line (
      tmc_request_line_id TEXT PRIMARY KEY,
      tmc_request_id TEXT NOT NULL REFERENCES tmc_request(tmc_request_id) ON DELETE CASCADE,
      tmc_item_id TEXT,
      item_name TEXT NOT NULL,
      part_no TEXT,
      serial_no TEXT,
      qty_requested REAL NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'pcs',
      qty_accepted REAL NOT NULL DEFAULT 0,
      qty_rejected REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_tmc_request_line_req ON tmc_request_line(tmc_request_id);

    CREATE TABLE IF NOT EXISTS tmc_request_attachment (
      tmc_request_attachment_id TEXT PRIMARY KEY,
      tmc_request_id TEXT NOT NULL REFERENCES tmc_request(tmc_request_id) ON DELETE CASCADE,
      file_name TEXT NOT NULL,
      mime_type TEXT,
      file_size_bytes INTEGER,
      sha256 TEXT,
      storage_root TEXT NOT NULL,
      storage_rel_path TEXT NOT NULL,
      uploaded_by TEXT,
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
      ai_processed_at TEXT,
      ai_extracted_json TEXT,
      ai_confidence REAL,
      notes TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_tmc_req_attach_req ON tmc_request_attachment(tmc_request_id, uploaded_at DESC);

    -- Inspection Cards (V2026_01_24_006)
    CREATE TABLE IF NOT EXISTS inspection_card (
      inspection_card_id TEXT PRIMARY KEY,
      tmc_request_id TEXT NOT NULL REFERENCES tmc_request(tmc_request_id) ON DELETE CASCADE,
      card_kind TEXT NOT NULL CHECK (card_kind IN ('INPUT','OUTPUT')),
      card_no TEXT UNIQUE,
      status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','IN_PROGRESS','COMPLETED','CANCELLED')),
      inspector_user_id TEXT,
      inspector_role TEXT,
      performed_at TEXT,
      summary TEXT,
      transitioned_by TEXT,
      transitioned_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_inspection_card_req ON inspection_card(tmc_request_id, card_kind, status);

    CREATE TABLE IF NOT EXISTS inspection_check_item_template (
      check_item_id TEXT PRIMARY KEY,
      applies_to TEXT NOT NULL CHECK (applies_to IN ('TV3-117','AI-9','NR-3','TMC_GENERIC')),
      card_kind TEXT NOT NULL CHECK (card_kind IN ('INPUT','OUTPUT')),
      item_order INTEGER NOT NULL DEFAULT 0,
      check_code TEXT NOT NULL,
      check_title TEXT NOT NULL,
      check_description TEXT,
      mandatory INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_check_template_kind ON inspection_check_item_template(applies_to, card_kind, item_order);

    CREATE TABLE IF NOT EXISTS inspection_check_result (
      inspection_check_result_id TEXT PRIMARY KEY,
      inspection_card_id TEXT NOT NULL REFERENCES inspection_card(inspection_card_id) ON DELETE CASCADE,
      check_item_id TEXT REFERENCES inspection_check_item_template(check_item_id) ON DELETE SET NULL,
      check_code TEXT NOT NULL,
      result TEXT NOT NULL CHECK (result IN ('PASS','FAIL','NA')),
      value TEXT,
      unit TEXT,
      comment TEXT,
      evidence_attachment_id TEXT REFERENCES tmc_request_attachment(tmc_request_attachment_id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_check_result_card ON inspection_check_result(inspection_card_id);

    -- TMC Request Lot Allocations (V2026_01_24_009)
    CREATE TABLE IF NOT EXISTS tmc_request_lot_allocation (
      tmc_request_lot_allocation_id TEXT PRIMARY KEY,
      tmc_request_id TEXT NOT NULL REFERENCES tmc_request(tmc_request_id) ON DELETE CASCADE,
      tmc_request_line_id TEXT,
      tmc_lot_id TEXT NOT NULL REFERENCES tmc_stock_lot(tmc_lot_id) ON DELETE RESTRICT,
      operation TEXT NOT NULL CHECK (operation IN ('OUT','TRANSFER','RESERVE','UNRESERVE','ADJUST')),
      qty REAL NOT NULL,
      from_location TEXT,
      to_location TEXT,
      status TEXT NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED','APPLIED','CANCELLED')),
      created_by TEXT,
      created_role TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      applied_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_allocation_request ON tmc_request_lot_allocation(tmc_request_id, status);
    CREATE INDEX IF NOT EXISTS idx_allocation_lot ON tmc_request_lot_allocation(tmc_lot_id);

    -- RBAC (V2026_01_24_005, V2026_01_24_007)
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

    -- Seed RBAC permissions
    INSERT OR IGNORE INTO rbac_permission(perm_code, perm_name, description) VALUES
    ('TMC.MANAGE','Управление ТМЦ','Создание позиций/лотов ТМЦ, движения'),
    ('TMC.REQUEST.VIEW','Просмотр заявок ТМЦ','Просмотр входящих/исходящих заявок ТМЦ'),
    ('TMC.REQUEST.MANAGE','Управление заявками ТМЦ','Создание/редактирование заявок ТМЦ'),
    ('INSPECTION.VIEW','Просмотр техкарт контроля','Просмотр техкарт входного/выходного контроля'),
    ('INSPECTION.MANAGE','Управление техкартами контроля','Создание/заполнение техкарт контроля');

    -- Seed RBAC roles
    INSERT OR IGNORE INTO rbac_role(role_code, role_name, description) VALUES
    ('ADMIN','Администратор','Полный доступ'),
    ('MANAGER','Менеджер','Управленческий доступ'),
    ('STOREKEEPER','Кладовщик','Доступ к складу'),
    ('ENGINEER','Инженер','Инженерный доступ');

    -- Map permissions to roles
    INSERT OR IGNORE INTO rbac_role_permission(role_code, perm_code) VALUES
    ('ADMIN','TMC.MANAGE'),
    ('MANAGER','TMC.MANAGE'),
    ('STOREKEEPER','TMC.MANAGE'),
    ('ADMIN','TMC.REQUEST.VIEW'),
    ('ADMIN','TMC.REQUEST.MANAGE'),
    ('ADMIN','INSPECTION.VIEW'),
    ('ADMIN','INSPECTION.MANAGE'),
    ('MANAGER','TMC.REQUEST.VIEW'),
    ('MANAGER','TMC.REQUEST.MANAGE'),
    ('MANAGER','INSPECTION.VIEW'),
    ('MANAGER','INSPECTION.MANAGE'),
    ('STOREKEEPER','TMC.REQUEST.VIEW'),
    ('STOREKEEPER','TMC.REQUEST.MANAGE'),
    ('STOREKEEPER','INSPECTION.VIEW'),
    ('STOREKEEPER','INSPECTION.MANAGE'),
    ('ENGINEER','TMC.REQUEST.VIEW'),
    ('ENGINEER','INSPECTION.VIEW');

    -- Seed inspection templates (V2026_01_24_006)
    INSERT OR IGNORE INTO inspection_check_item_template(check_item_id, applies_to, card_kind, item_order, check_code, check_title, check_description, mandatory) VALUES
    ('CHK-TMC-IN-001','TMC_GENERIC','INPUT', 10, 'DOCS', 'Проверка документов', 'Сопроводительные документы, накладные, сертификаты, формуляры (если применимо)', 1),
    ('CHK-TMC-IN-002','TMC_GENERIC','INPUT', 20, 'PACK', 'Проверка упаковки/тары', 'Отсутствие повреждений, наличие маркировки', 1),
    ('CHK-TMC-IN-003','TMC_GENERIC','INPUT', 30, 'QTY',  'Проверка количества', 'Соответствие количеству по документам/заявке', 1),
    ('CHK-TMC-IN-004','TMC_GENERIC','INPUT', 40, 'VIS',  'Визуальный контроль', 'Повреждения, коррозия, комплектность', 1),
    ('CHK-TMC-OUT-001','TMC_GENERIC','OUTPUT',10, 'QTY',  'Проверка количества к выдаче', 'Списание/выдача по заявке', 1),
    ('CHK-TMC-OUT-002','TMC_GENERIC','OUTPUT',20, 'MARK', 'Маркировка/идентификация', 'Идентификация партии/серийности', 1),
    ('CHK-TMC-OUT-003','TMC_GENERIC','OUTPUT',30, 'PACK', 'Упаковка/консервация', 'Упаковка согласно требованиям', 1);

    -- Seed inspection cards for MVP (read-only API demo)
    INSERT OR IGNORE INTO tmc_request(tmc_request_id, request_no, request_kind, request_category, title, status) VALUES
    ('REQ-SEED-001','SEED-001','INCOMING','TECH_CARD','Seed request for inspection', 'SUBMITTED');
    INSERT OR IGNORE INTO inspection_card(inspection_card_id, tmc_request_id, card_kind, card_no, status, summary) VALUES
    ('CARD-SEED-001','REQ-SEED-001','INPUT','IC-001','DRAFT','Seed inspection card'),
    ('CARD-SEED-002','REQ-SEED-001','OUTPUT','IC-002','IN_PROGRESS','Output control seed');

    -- Users (US-1, V2026_02_01)
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

    -- New permissions for API
    INSERT OR IGNORE INTO rbac_permission(perm_code, perm_name, description) VALUES
    ('WORKSPACE.READ','Просмотр workspace','Статус, список файлов'),
    ('FILES.LIST','Список файлов','Просмотр файлов workspace'),
    ('FILES.UPLOAD','Загрузка файлов','Загрузка в AI inbox'),
    ('LEDGER.READ','Просмотр ledger','Чтение событий'),
    ('LEDGER.APPEND','Добавление в ledger','Запись событий'),
    ('ADMIN.MANAGE_USERS','Управление пользователями','Создание, роли, сброс паролей');

    INSERT OR IGNORE INTO rbac_role(role_code, role_name, description) VALUES
    ('AUDITOR','Аудитор','Только просмотр');

    INSERT OR IGNORE INTO rbac_role_permission(role_code, perm_code) VALUES
    ('ADMIN','WORKSPACE.READ'),('ADMIN','FILES.LIST'),('ADMIN','FILES.UPLOAD'),('ADMIN','LEDGER.READ'),('ADMIN','LEDGER.APPEND'),('ADMIN','ADMIN.MANAGE_USERS'),
    ('MANAGER','WORKSPACE.READ'),('MANAGER','FILES.LIST'),('MANAGER','FILES.UPLOAD'),('MANAGER','LEDGER.READ'),
    ('STOREKEEPER','WORKSPACE.READ'),('STOREKEEPER','FILES.LIST'),('STOREKEEPER','FILES.UPLOAD'),('STOREKEEPER','LEDGER.READ'),
    ('ENGINEER','WORKSPACE.READ'),('ENGINEER','FILES.LIST'),('ENGINEER','LEDGER.READ'),
    ('AUDITOR','WORKSPACE.READ'),('AUDITOR','FILES.LIST'),('AUDITOR','LEDGER.READ'),('AUDITOR','INSPECTION.VIEW');
  `);

  return db;
}

/**
 * US-8: Read-only соединение для AI-facing и read-only контекстов.
 * БД должна существовать. Использовать для: списки, пагинация, проверки.
 */
export function getDbReadOnly(): DbAdapter {
  if (dbReadOnly) return dbReadOnly;
  dbReadOnly = createSqliteAdapter({ mode: 'readonly' });
  return dbReadOnly;
}

export function hashChain(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

export function checksumFileSync(filePath: string): string {
  const content = readFileSync(filePath);
  return createHash('sha256').update(content).digest('hex');
}
