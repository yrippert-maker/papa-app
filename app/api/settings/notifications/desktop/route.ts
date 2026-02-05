/**
 * POST /api/settings/notifications/desktop
 * macOS: display notification via osascript. Body: { title, body }.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { badRequest } from '@/lib/api/error-response';
import { execSync } from 'child_process';

export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.SETTINGS_VIEW);
  if (err) return err;
  try {
    const body = await req.json().catch(() => ({}));
    const title = String(body.title ?? 'ПАПА').slice(0, 200).replace(/["\\]/g, '\\$&');
    const bodyText = String(body.body ?? '').slice(0, 500).replace(/["\\]/g, '\\$&');
    if (!bodyText && !title) return badRequest('title or body required', req.headers);
    const script = `display notification "${bodyText}" with title "${title}"`;
    execSync(`osascript -e ${JSON.stringify(script)}`, { stdio: 'ignore' });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (process.platform !== 'darwin') {
      return NextResponse.json({ error: 'Desktop notifications only supported on macOS' }, { status: 501 });
    }
    console.error('[settings/notifications/desktop]', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Notification failed' }, { status: 500 });
  }
}
