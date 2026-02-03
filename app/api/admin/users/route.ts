import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { badRequest, rateLimitError } from '@/lib/api/error-response';
import { checkRateLimit, getClientKey } from '@/lib/rate-limit';
import { getDb, getDbReadOnly, withRetry } from '@/lib/db';
import { hashSync } from 'bcryptjs';
import { z } from 'zod';
import { appendAdminAudit } from '@/lib/admin-audit';
import { parsePaginationParams, encodeCursor } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

const createUserSchema = z.object({
  email: z.string().email().min(1).max(255).transform((s) => s.trim().toLowerCase()),
  password: z.string().min(8).max(128),
  role_code: z.enum(['ADMIN', 'MANAGER', 'STOREKEEPER', 'ENGINEER', 'AUDITOR']),
});

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const err = requirePermission(session, PERMISSIONS.ADMIN_MANAGE_USERS, req);
  if (err) return err;

  try {
    const url = new URL(req.url);
    const { limit, cursor } = parsePaginationParams(url.searchParams);

    const db = getDbReadOnly();
    let rows: Array<{ id: number; email: string; role_code: string; created_at: string }>;
    let nextCursor: string | null = null;

    if (cursor) {
      const afterId = parseInt(cursor, 10);
      if (Number.isNaN(afterId) || afterId < 1) {
        return badRequest('Invalid cursor', req.headers);
      }
      rows = db.prepare(`
        SELECT id, email, role_code, created_at
        FROM users
        WHERE id < ?
        ORDER BY id DESC
        LIMIT ?
      `).all(afterId, limit + 1) as Array<{ id: number; email: string; role_code: string; created_at: string }>;
    } else {
      rows = db.prepare(`
        SELECT id, email, role_code, created_at
        FROM users
        ORDER BY id DESC
        LIMIT ?
      `).all(limit + 1) as Array<{ id: number; email: string; role_code: string; created_at: string }>;
    }

    const hasMore = rows.length > limit;
    if (hasMore) {
      rows = rows.slice(0, limit);
      nextCursor = encodeCursor(String(rows[rows.length - 1].id));
    }

    return NextResponse.json({
      users: rows,
      nextCursor,
      hasMore,
    });
  } catch (e) {
    if (e instanceof Error && (e.message === 'Invalid limit' || e.message === 'Invalid cursor' || e.message === 'Invalid offset')) {
      return badRequest(e.message, req.headers);
    }
    console.error('[admin/users]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'List failed' },
      { status: 500 }
    );
  }
}

const WRITE_RATE_LIMIT = { windowMs: 60_000, max: 60 };

export async function POST(req: Request) {
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

  try {
    const body = await req.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues?.map((i) => i.message).join('; ') ?? 'Validation failed';
      return badRequest(msg, req.headers);
    }
    const { email, password, role_code } = parsed.data;

    const passwordHash = hashSync(password, 12);
    const actorEmail = (session?.user?.email as string) ?? 'unknown';
    const actorId = (session?.user?.id as string) ?? '0';

    const result = await withRetry(() => {
      const db = getDb();
      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (existing) {
        appendAdminAudit(
          { type: 'USER_CREATE_DENIED', payload: { actor_id: actorId, actor_email: actorEmail, target_email: email, reason: 'duplicate_email' } },
          actorId
        );
        return { conflict: true } as const;
      }
      const r = db.prepare(
        'INSERT INTO users (email, password_hash, role_code) VALUES (?, ?, ?)'
      ).run(email, passwordHash, role_code);
      appendAdminAudit(
        { type: 'USER_CREATED', payload: { actor_id: actorId, actor_email: actorEmail, target_email: email, role_code } },
        actorId
      );
      return { id: r.lastInsertRowid as number };
    });

    if ('conflict' in result && result.conflict) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
    }
    const id = result.id;

    return NextResponse.json({
      id,
      email,
      role_code,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[admin/users POST]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Create failed' },
      { status: 500 }
    );
  }
}
