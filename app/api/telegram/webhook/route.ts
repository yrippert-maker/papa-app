/**
 * POST /api/telegram/webhook — обработка updates от Telegram Bot API (FR-7.4–7.6).
 * Настроить в BotFather: setWebhook → https://<domain>/api/telegram/webhook
 * Принимает: message, callback_query (нажатие inline-кнопки).
 * FR-7.5: сохранение ответов. FR-7.6: авторизация (привязка телеграм → аккаунт).
 */
import { NextRequest, NextResponse } from 'next/server';
import { sendTelegram } from '@/lib/telegram-notify';
import { getBoundUserByTelegramId, saveTelegramResponse, consumeBindCode, bindTelegramUser } from '@/lib/telegram-auth';

export const dynamic = 'force-dynamic';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim();

type TelegramUpdate = {
  update_id: number;
  message?: {
    chat: { id: number; type: string };
    from?: { id: number; username?: string; first_name?: string };
    text?: string;
  };
  callback_query?: {
    id: string;
    from: { id: number; username?: string };
    message?: { chat: { id: number } };
    data?: string;
  };
};

function answerCallback(token: string, callbackQueryId: string, text: string): Promise<Response> {
  return fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  if (!BOT_TOKEN) {
    return NextResponse.json({ ok: false, error: 'No TELEGRAM_BOT_TOKEN' }, { status: 500 });
  }

  let update: TelegramUpdate;
  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const chatId = String(
    update.message?.chat?.id ?? update.callback_query?.message?.chat?.id ?? ''
  );
  const telegramId = String(
    update.message?.from?.id ?? update.callback_query?.from?.id ?? ''
  );
  if (!chatId) return NextResponse.json({ ok: true });

  if (update.callback_query) {
    const cb = update.callback_query;
    saveTelegramResponse({
      telegram_id: telegramId,
      chat_id: chatId,
      update_id: update.update_id,
      type: 'callback',
      data: cb.data,
      at: new Date().toISOString(),
    });
    const data = cb.data ?? '';
    if (data === 'help') {
      await answerCallback(BOT_TOKEN, cb.id, 'Справка');
      await sendTelegram(chatId, 'Помощь: уведомления приходят при событиях в ПАПА (одобрения, алерты).');
    } else if (data.startsWith('auth:')) {
      await answerCallback(BOT_TOKEN, cb.id, 'Обработано');
      const code = data.slice(5);
      await sendTelegram(chatId, `Код авторизации (FR-7.6): \`${code}\`. Введите в ПАПА для привязки.`);
    } else if (data.startsWith('ack:')) {
      await answerCallback(BOT_TOKEN, cb.id, 'Подтверждено');
      await sendTelegram(chatId, 'Подтверждено.');
    } else {
      await answerCallback(BOT_TOKEN, cb.id, 'OK');
    }
    return NextResponse.json({ ok: true });
  }

  const text = update.message?.text?.trim() ?? '';
  saveTelegramResponse({
    telegram_id: telegramId,
    chat_id: chatId,
    update_id: update.update_id,
    type: 'message',
    text,
    at: new Date().toISOString(),
  });

  if (text === '/start') {
    await sendTelegram(chatId, 'ПАПА Bot. Уведомления по компетенциям. Команды: /start, /help.', {
      inlineButtons: [[{ text: 'Справка', callback_data: 'help' }]],
    });
    return NextResponse.json({ ok: true });
  }
  if (text === '/help') {
    await sendTelegram(chatId, 'Помощь: уведомления приходят при событиях в ПАПА (одобрения, алерты).');
    return NextResponse.json({ ok: true });
  }
  if (text === '/status') {
    const boundEmail = getBoundUserByTelegramId(telegramId);
    await sendTelegram(
      chatId,
      boundEmail ? `Привязан к аккаунту: ${boundEmail}` : 'Не привязан. В ПАПА: Настройки → Привязать Telegram, затем отправьте сюда /bind <код>.',
    );
    return NextResponse.json({ ok: true });
  }
  if (text.startsWith('/bind ')) {
    const code = text.slice(6).trim();
    const bound = getBoundUserByTelegramId(telegramId);
    if (bound) {
      await sendTelegram(chatId, `Уже привязан: ${bound}`);
      return NextResponse.json({ ok: true });
    }
    const consumed = consumeBindCode(code);
    if (consumed) {
      bindTelegramUser(telegramId, consumed.user_email, consumed.user_id);
      await sendTelegram(chatId, `Привязка выполнена: ${consumed.user_email}`);
    } else {
      await sendTelegram(chatId, 'Код не найден или истёк. Получите новый в ПАПА → Настройки → Привязать Telegram.');
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
