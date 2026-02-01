#!/usr/bin/env node
/**
 * Создаёт первого admin-пользователя, если users пуста.
 * Использование: node scripts/seed-admin.mjs [email] [password]
 * По умолчанию: admin@local / admin (только для dev!)
 */
import Database from 'better-sqlite3';
import { hashSync } from 'bcryptjs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = join(__dirname, '..');
const dbPath = process.env.DB_PATH || join(process.env.WORKSPACE_ROOT || join(root, 'data'), '00_SYSTEM/db/papa.sqlite');

const email = process.argv[2] || 'admin@local';
const password = process.argv[3] || 'admin';

const db = new Database(dbPath);
const existing = db.prepare('SELECT COUNT(*) as c FROM users').get();
if (existing.c > 0) {
  console.log('Users already exist, skipping seed.');
  process.exit(0);
}

const passwordHash = hashSync(password, 12); // cost 12 — адекватно для 2024+
db.prepare('INSERT INTO users (email, password_hash, role_code) VALUES (?, ?, ?)').run(email, passwordHash, 'ADMIN');
console.log('Created admin user:', email);
// Auditor для E2E RBAC-проверок
const auditorExists = db.prepare('SELECT 1 FROM users WHERE email = ?').get('auditor@local');
if (!auditorExists) {
  const auditorHash = hashSync('auditor', 10);
  db.prepare('INSERT INTO users (email, password_hash, role_code) VALUES (?, ?, ?)').run('auditor@local', auditorHash, 'AUDITOR');
  console.log('Created auditor user: auditor@local');
}
db.close();
