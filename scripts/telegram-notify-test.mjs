#!/usr/bin/env node
/**
 * Тест Telegram-уведомлений.
 * Usage: TELEGRAM_BOT_TOKEN=... node scripts/telegram-notify-test.mjs [role]
 * role: ADMIN|MANAGER|ENGINEER|all (default: ADMIN)
 * Requires: config/telegram-competencies.json with roleChatIds
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
if (!token) {
  console.error('TELEGRAM_BOT_TOKEN required');
  process.exit(1);
}

const role = process.argv[2] || 'ADMIN';
const msg = `ПАПА: тест уведомления (${new Date().toISOString()})`;

let chatIds = [];
const configPath = join(process.cwd(), 'config', 'telegram-competencies.json');
if (existsSync(configPath)) {
  const cfg = JSON.parse(readFileSync(configPath, 'utf8'));
  if (role === 'all') {
    chatIds = [
      ...(cfg.alertChatId ? [cfg.alertChatId] : []),
      ...Object.values(cfg.roleChatIds || {}).filter(Boolean),
    ];
  } else if (cfg.roleChatIds?.[role]) {
    chatIds = [cfg.roleChatIds[role]];
  }
}

if (chatIds.length === 0) {
  console.error(`No chat_id for role "${role}". Edit config/telegram-competencies.json`);
  process.exit(1);
}

const BOT_API = 'https://api.telegram.org/bot';
let sent = 0;
for (const chatId of chatIds) {
  const res = await fetch(`${BOT_API}${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: msg }),
  });
  if (res.ok) sent++;
  else console.error('sendMessage failed:', res.status, await res.text());
}

console.log(JSON.stringify({ ok: true, role, sent, total: chatIds.length, message: msg }));
