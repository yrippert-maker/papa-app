/**
 * Проверки безопасности для production.
 * Fail-fast: обнаружение default creds блокирует запуск/статус.
 */
import { compareSync } from 'bcryptjs';
import { getDbReadOnly, dbGet } from './db';

/** admin@local с паролем "admin" — запрещено в production */
const DEFAULT_ADMIN_EMAIL = 'admin@local';
const DEFAULT_ADMIN_PASSWORD = 'admin';

/**
 * Проверяет, есть ли в БД пользователь с default creds (admin@local / admin).
 * Использовать в production: если true — возвращать 500.
 */
export async function hasDefaultAdminCredentials(): Promise<boolean> {
  try {
    const db = await getDbReadOnly();
    const row = (await dbGet(db, 'SELECT password_hash FROM users WHERE email = ?', DEFAULT_ADMIN_EMAIL)) as { password_hash: string } | undefined;
    if (!row) return false;
    return compareSync(DEFAULT_ADMIN_PASSWORD, row.password_hash);
  } catch {
    return false;
  }
}
