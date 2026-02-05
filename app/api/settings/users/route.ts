/**
 * GET/POST /api/settings/users
 * Spec: id, email, role (Owner|Admin|Operator|Reviewer|Viewer), active, lastLoginAt.
 * Owner/Admin only. Proxies to same DB as /api/admin/users; spec role names.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { badRequest, rateLimitError } from '@/lib/api/error-response';
import { checkRateLimit, getClientKey } from '@/lib/rate-limit';
import { getDb, getDbReadOnly, withRetry, dbGet, dbAll, dbRun } from '@/lib/db';
import { hashSync } from 'bcryptjs';
import { appendAdminAudit } from '@/lib/admin-audit';

export const dynamic = 'force-dynamic';

const ROLE_TO_SPEC: Record<string, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MANAGER: 'Operator',
  STOREKEEPER: 'Operator',
  ENGINEER: 'Operator',
  AUDITOR: 'Viewer',
};
const SPEC_TO_ROLE: Record<string, string> = {
  Owner: 'OWNER',
  Admin: 'ADMIN',
  Operator: 'MANAGER',
  Reviewer: 'ENGINEER',
  Viewer: 'AUDITOR',
};

function toSpecRole(roleCode: string): string {
  return ROLE_TO_SPEC[roleCode] ?? roleCode;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.ADMIN_MANAGE_USERS);
  if (err) return err;
  try {
    const db = await getDbReadOnly();
    const rows = (await dbAll(db, 'SELECT id, email, role_code, is_active, created_at FROM users ORDER BY id')) as Array<{ id: number; email: string; role_code: string; is_active?: number; created_at: string }>;
    const list = rows.map((r) => ({
      id: `u_${r.id}`,
      email: r.email,
      role: toSpecRole(r.role_code),
      active: r.is_active !== undefined ? Boolean(r.is_active) : true,
      lastLoginAt: null as string | null,
    }));
    return NextResponse.json(list);
  } catch (e) {
    console.error('[settings/users GET]', e);
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 });
  }
}

const WRITE_RATE_LIMIT = { windowMs: 60_000, max: 60 };

export async function POST(req: Request) {
  const key = `settings-users:${getClientKey(req)}`;
  const { allowed, retryAfterMs } = checkRateLimit(key, WRITE_RATE_LIMIT);
  if (!allowed) return rateLimitError('Too many requests', req.headers, retryAfterMs ? Math.ceil(retryAfterMs / 1000) : undefined);
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.ADMIN_MANAGE_USERS);
  if (err) return err;
  try {
    const body = await req.json();
    const email = String(body.email ?? '').trim().toLowerCase();
    if (!email) return badRequest('email required', req.headers);
    const specRole = body.role ?? 'Operator';
    const role_code = SPEC_TO_ROLE[specRole] ?? 'MANAGER';
    const password = body.password ?? require('crypto').randomBytes(12).toString('base64').slice(0, 12);
    const passwordHash = hashSync(password, 12);
    const actorId = (session?.user?.id as string) ?? '0';
    const actorEmail = (session?.user?.email as string) ?? 'unknown';
    const result = await withRetry(async () => {
      const db = await getDb();
      const existing = await dbGet(db, 'SELECT id FROM users WHERE email = ?', email);
      if (existing) {
        await appendAdminAudit({ type: 'USER_CREATE_DENIED', payload: { actor_id: actorId, actor_email: actorEmail, target_email: email, reason: 'duplicate_email' } }, actorId);
        return { conflict: true } as const;
      }
      const r = await dbRun(db, 'INSERT INTO users (email, password_hash, role_code) VALUES (?, ?, ?)', email, passwordHash, role_code);
      await appendAdminAudit({ type: 'USER_CREATED', payload: { actor_id: actorId, actor_email: actorEmail, target_email: email, role_code } }, actorId);
      return { id: r.lastInsertRowid };
    });
    if ('conflict' in result && result.conflict) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
    }
    const id = result.id;
    const db = await getDbReadOnly();
    const row = (await dbGet(db, 'SELECT id, email, role_code FROM users WHERE id = ?', id)) as { id: number; email: string; role_code: string } | undefined;
    if (!row) return NextResponse.json({ id: `u_${id}`, email, role: toSpecRole(role_code), active: true, lastLoginAt: null });
    return NextResponse.json({ id: `u_${row.id}`, email: row.email, role: toSpecRole(row.role_code), active: true, lastLoginAt: null });
  } catch (e) {
    console.error('[settings/users POST]', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Create failed' }, { status: 500 });
  }
}
