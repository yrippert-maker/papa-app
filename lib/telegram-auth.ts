/**
 * FR-7.5–7.6: Привязка Telegram ID к аккаунту ПАПА, сохранение ответов.
 * Хранение: config/telegram-users.json (telegram_id → user_email).
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { nanoid } from 'nanoid';

const CONFIG_DIR = join(process.cwd(), 'config');
const USERS_FILE = join(CONFIG_DIR, 'telegram-users.json');
const RESPONSES_FILE = join(process.cwd(), 'data', '00_SYSTEM', 'telegram-responses.jsonl');

export type TelegramUserBinding = {
  telegram_id: string;
  user_email: string;
  user_id?: string;
  bound_at: string;
};

export type TelegramResponse = {
  telegram_id: string;
  chat_id: string;
  update_id?: number;
  type: 'message' | 'callback';
  data?: string;
  text?: string;
  at: string;
};

function loadBindings(): TelegramUserBinding[] {
  if (!existsSync(USERS_FILE)) return [];
  try {
    const raw = readFileSync(USERS_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data?.bindings) ? data.bindings : [];
  } catch {
    return [];
  }
}

function saveBindings(bindings: TelegramUserBinding[]): void {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(USERS_FILE, JSON.stringify({ bindings }, null, 2), 'utf8');
}

export function getBoundUserByTelegramId(telegramId: string): string | null {
  const bindings = loadBindings();
  const b = bindings.find((x) => x.telegram_id === String(telegramId));
  return b?.user_email ?? null;
}

export function bindTelegramUser(telegramId: string, userEmail: string, userId?: string): void {
  const bindings = loadBindings();
  const existing = bindings.findIndex((x) => x.telegram_id === String(telegramId));
  const binding: TelegramUserBinding = {
    telegram_id: String(telegramId),
    user_email: userEmail,
    user_id: userId,
    bound_at: new Date().toISOString(),
  };
  if (existing >= 0) {
    bindings[existing] = binding;
  } else {
    bindings.push(binding);
  }
  saveBindings(bindings);
}

export function unbindTelegramUser(telegramId: string): boolean {
  const bindings = loadBindings();
  const idx = bindings.findIndex((x) => x.telegram_id === String(telegramId));
  if (idx < 0) return false;
  bindings.splice(idx, 1);
  saveBindings(bindings);
  return true;
}

export function saveTelegramResponse(res: TelegramResponse): void {
  const dir = join(process.cwd(), 'data', '00_SYSTEM');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const line = JSON.stringify(res) + '\n';
  writeFileSync(RESPONSES_FILE, line, { flag: 'a' });
}

const BIND_CODES_FILE = join(process.cwd(), 'data', '00_SYSTEM', 'telegram-bind-codes.json');

type BindCodeEntry = { code: string; user_email: string; user_id?: string; created_at: string };

function loadBindCodes(): BindCodeEntry[] {
  const dir = join(process.cwd(), 'data', '00_SYSTEM');
  if (!existsSync(dir)) return [];
  if (!existsSync(BIND_CODES_FILE)) return [];
  try {
    const raw = readFileSync(BIND_CODES_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data?.codes) ? data.codes : [];
  } catch {
    return [];
  }
}

function saveBindCodes(codes: BindCodeEntry[]): void {
  const dir = join(process.cwd(), 'data', '00_SYSTEM');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(BIND_CODES_FILE, JSON.stringify({ codes }, null, 2), 'utf8');
}

/** Создать код привязки (вызывается из API при запросе пользователя в ПАПА). */
export function createBindCode(userEmail: string, userId?: string): string {
  const codes = loadBindCodes();
  const code = nanoid(8);
  const expires = new Date(Date.now() - 10 * 60 * 1000); // удаляем коды старше 10 мин при проверке
  const valid = codes.filter((c) => new Date(c.created_at) > expires);
  valid.push({ code, user_email: userEmail, user_id: userId, created_at: new Date().toISOString() } as BindCodeEntry);
  saveBindCodes(valid);
  return code;
}

/** Потребить код привязки (вызывается из webhook при /bind <code>). */
export function consumeBindCode(code: string): { user_email: string; user_id?: string } | null {
  const codes = loadBindCodes();
  const idx = codes.findIndex((c) => c.code === code);
  if (idx < 0) return null;
  const entry = codes[idx];
  codes.splice(idx, 1);
  saveBindCodes(codes);
  return { user_email: entry.user_email, user_id: entry.user_id };
}
