import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { badRequest, rateLimitError } from '@/lib/api/error-response';
import { checkRateLimit, getClientKey } from '@/lib/rate-limit';
import { getDb, withRetry } from '@/lib/db';
import { hashSync } from 'bcryptjs';
import { z } from 'zod';
import { appendAdminAudit } from '@/lib/admin-audit';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  role_code: z.enum(['ADMIN', 'MANAGER', 'STOREKEEPER', 'ENGINEER', 'AUDITOR']).optional(),
  reset_password: z.literal(true).optional(),
});

function randomPassword(length = 12): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

const WRITE_RATE_LIMIT = { windowMs: 60_000, max: 60 };

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const key = `admin-users:${getClientKey(req)}`;
  const { allowed, retryAfterMs } = checkRateLimit(key, WRITE_RATE_LIMIT);
  if (!allowed) {
    return rateLimitError(
      'Too many requests',
      req.headers,
      retryAfterMs ? Math.ceil(retryAfterMs / 1000) : undefined
    );
  }

  const session = await getServerSession(authOptions);
  const err = requirePermission(session, PERMISSIONS.ADMIN_MANAGE_USERS, req);
  if (err) return err;

  const { id } = await params;
  const userId = parseInt(id, 10);
  if (Number.isNaN(userId) || userId < 1) {
    return badRequest('Invalid user id', req.headers);
  }

  try {
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues?.map((i) => i.message).join('; ') ?? 'Validation failed';
      return badRequest(msg, req.headers);
    }
    const { role_code, reset_password } = parsed.data;
    if (!role_code && !reset_password) {
      return badRequest('Specify role_code or reset_password', req.headers);
    }

    const actorId = (session?.user?.id as string) ?? '0';
    const actorEmail = (session?.user?.email as string) ?? 'unknown';

    const updated = await withRetry(() => {
      const db = getDb();
      const row = db.prepare('SELECT id, email, role_code FROM users WHERE id = ?').get(userId) as
        | { id: number; email: string; role_code: string }
        | undefined;
      if (!row) return { notFound: true } as const;

      if (role_code && role_code !== row.role_code) {
        if (String(row.id) === actorId) {
        appendAdminAudit(
          {
            type: 'USER_ROLE_CHANGE_DENIED',
            payload: {
              actor_id: actorId,
              actor_email: actorEmail,
              target_id: String(row.id),
              target_email: row.email,
              reason: 'self_demote',
            },
          },
          actorId
        );
          return { selfDemote: true } as const;
        }
        db.prepare('UPDATE users SET role_code = ?, updated_at = datetime(\'now\') WHERE id = ?').run(
          role_code,
          userId
        );
        appendAdminAudit(
          {
            type: 'USER_ROLE_CHANGED',
            payload: {
              actor_id: actorId,
              actor_email: actorEmail,
              target_id: String(row.id),
              target_email: row.email,
              old_role: row.role_code,
              new_role: role_code,
            },
          },
          actorId
        );
      }

    let newPassword: string | null = null;
      if (reset_password) {
        newPassword = randomPassword(12);
        const passwordHash = hashSync(newPassword, 12);
        db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?').run(
          passwordHash,
          userId
        );
        appendAdminAudit(
          {
            type: 'USER_PASSWORD_RESET',
            payload: {
              actor_id: actorId,
              actor_email: actorEmail,
              target_id: String(row.id),
              target_email: row.email,
            },
          },
          actorId
        );
    }

    const u = db.prepare('SELECT id, email, role_code, created_at, updated_at FROM users WHERE id = ?').get(userId) as
        { id: number; email: string; role_code: string; created_at: string; updated_at: string };
      return { ...u, newPassword };
    });

    if ('notFound' in updated && updated.notFound) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if ('selfDemote' in updated && updated.selfDemote) {
      return badRequest('Cannot change your own role', req.headers);
    }
    const { newPassword: np, ...user } = updated as { id: number; email: string; role_code: string; created_at: string; updated_at: string; newPassword: string | null };
    return NextResponse.json({
      ...user,
      ...(np ? { temporary_password: np } : {}),
    });
  } catch (e) {
    console.error('[admin/users PATCH]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Update failed' },
      { status: 500 }
    );
  }
}
