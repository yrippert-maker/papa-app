/**
 * POST /api/settings/telegram/bind — FR-7.6: получить код для привязки Telegram.
 * Возвращает код, который пользователь отправляет боту: /bind <код>
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { createBindCode } from '@/lib/telegram-auth';

export const dynamic = 'force-dynamic';

export async function POST(): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const code = createBindCode(session.user.email, session.user.id as string);
  return NextResponse.json({
    code,
    hint: 'Отправьте боту в Telegram: /bind ' + code,
    expires_minutes: 10,
  });
}
