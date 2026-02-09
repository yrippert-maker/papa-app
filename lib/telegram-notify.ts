/**
 * Telegram Bot API — уведомления по компетенциям (ролям).
 * Использует TELEGRAM_BOT_TOKEN и config/telegram-competencies.json.
 */
const BOT_API = 'https://api.telegram.org/bot';

export type NotifyTarget = 'all' | string; // role_code | chat_id

export type TelegramConfig = {
  /** Роль → chat_id. chat_id может быть числом или строка (для групп/каналов). */
  roleChatIds: Record<string, string>;
  /** Канал для всех срочных уведомлений. */
  alertChatId?: string;
};

let cachedConfig: TelegramConfig | null = null;

export function getTelegramConfig(): TelegramConfig | null {
  if (cachedConfig) return cachedConfig;
  try {
    const fs = require('fs');
    const path = require('path');
    const p = path.join(process.cwd(), 'config', 'telegram-competencies.json');
    if (fs.existsSync(p)) {
      cachedConfig = JSON.parse(fs.readFileSync(p, 'utf8')) as TelegramConfig;
      return cachedConfig;
    }
  } catch {
    // ignore
  }
  return null;
}

export type InlineButton = {
  text: string;
  callback_data?: string;
  url?: string;
};

/**
 * Отправка сообщения в Telegram.
 * @param options.inlineButtons — кнопки под сообщением (FR-7.4).
 * @returns true если отправлено, false если нет токена/чата.
 */
export async function sendTelegram(
  chatId: string,
  text: string,
  options?: { inlineButtons?: InlineButton[][] }
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return false;

  try {
    const url = `${BOT_API}${token}/sendMessage`;
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text: text.slice(0, 4096),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    };
    if (options?.inlineButtons?.length) {
      body.reply_markup = {
        inline_keyboard: options.inlineButtons.map((row) =>
          row.map((b) => ({
            text: b.text,
            ...(b.callback_data && { callback_data: b.callback_data.slice(0, 64) }),
            ...(b.url && { url: b.url }),
          }))
        ),
      };
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('[telegram-notify] sendMessage failed:', res.status, err);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[telegram-notify]', e);
    return false;
  }
}

/**
 * Уведомление по роли (компетенции).
 * Если role = 'all' — отправляет в alertChatId или во все чаты из конфига.
 * FR-7.4: inlineButtons — кнопки под сообщением.
 */
export async function notifyByRole(
  role: NotifyTarget,
  message: string,
  options?: { prefix?: string; inlineButtons?: InlineButton[][] }
): Promise<number> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return 0;

  const config = getTelegramConfig();
  if (!config?.roleChatIds) return 0;

  const text = options?.prefix ? `${options.prefix}\n\n${message}` : message;
  const chatIds = new Set<string>();

  if (role === 'all') {
    if (config.alertChatId) chatIds.add(config.alertChatId);
    Object.values(config.roleChatIds).forEach((id) => chatIds.add(id));
  } else if (config.roleChatIds[role]) {
    chatIds.add(config.roleChatIds[role]);
  } else if (/^-?\d+$/.test(role)) {
    chatIds.add(role);
  }

  let sent = 0;
  for (const cid of chatIds) {
    if (await sendTelegram(cid, text, { inlineButtons: options?.inlineButtons })) sent++;
  }
  return sent;
}
