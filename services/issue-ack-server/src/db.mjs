import Database from 'better-sqlite3';

export function openDb(filePath) {
  const db = new Database(filePath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS issue_ack (
      fingerprint TEXT PRIMARY KEY,
      pack_sha256 TEXT,
      ack_by TEXT,
      ack_reason TEXT,
      created_at TEXT,
      expires_at TEXT,
      meta_json TEXT
    );
  `);
  return db;
}

export function upsertAck(db, row) {
  const stmt = db.prepare(`
    INSERT INTO issue_ack (fingerprint, pack_sha256, ack_by, ack_reason, created_at, expires_at, meta_json)
    VALUES (@fingerprint, @pack_sha256, @ack_by, @ack_reason, @created_at, @expires_at, @meta_json)
    ON CONFLICT(fingerprint) DO UPDATE SET
      pack_sha256=excluded.pack_sha256,
      ack_by=excluded.ack_by,
      ack_reason=excluded.ack_reason,
      created_at=excluded.created_at,
      expires_at=excluded.expires_at,
      meta_json=excluded.meta_json
  `);
  stmt.run(row);
}

export function getAck(db, fingerprint) {
  const stmt = db.prepare('SELECT * FROM issue_ack WHERE fingerprint = ?');
  return stmt.get(fingerprint) || null;
}

export function listAcks(db, { limit = 200, activeOnly = true } = {}) {
  const now = new Date().toISOString();
  if (activeOnly) {
    return db
      .prepare('SELECT * FROM issue_ack WHERE expires_at IS NULL OR expires_at > ? ORDER BY created_at DESC LIMIT ?')
      .all(now, limit);
  }
  return db.prepare('SELECT * FROM issue_ack ORDER BY created_at DESC LIMIT ?').all(limit);
}
