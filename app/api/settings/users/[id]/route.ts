/**
 * PATCH/DELETE /api/settings/users/{id}
 * Spec: id is u_<numeric>. Cannot delete last Owner.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { badRequest, forbidden, rateLimitError } from '@/lib/api/error-response';
import { checkRateLimit, getClientKey } from '@/lib/rate-limit';
import { getDb, withRetry, dbGet, dbAll, dbRun } from '@/lib/db';
import { hashSync } from 'bcryptjs';
import { randomBytes } from 'crypto';
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

const WRITE_RATE_LIMIT = { windowMs: 60_000, max: 60 };

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const key = `settings-users:${getClientKey(req)}`;
  const { allowed, retryAfterMs } = checkRateLimit(key, WRITE_RATE_LIMIT);
  if (!allowed) return rateLimitError('Too many requests', req.headers, retryAfterMs ? Math.ceil(retryAfterMs / 1000) : undefined);
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.ADMIN_MANAGE_USERS);
  if (err) return err;
  const rawId = (await params).id;
  const userId = rawId.startsWith('u_') ? parseInt(rawId.slice(2), 10) : parseInt(rawId, 10);
  if (Number.isNaN(userId) || userId < 1) return badRequest('Invalid user id', req.headers);
  try {
    const body = await req.json();
    const db = await getDb();
    const row = (await dbGet(db, 'SELECT id, email, role_code, is_active FROM users WHERE id = ?', userId)) as { id: number; email: string; role_code: string; is_active?: number } | undefined;
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const updates: string[] = [];
    const values: unknown[] = [];
    if (body.role !== undefined) {
      const role_code = SPEC_TO_ROLE[body.role] ?? body.role;
      updates.push('role_code = ?');
      values.push(role_code);
    }
    if (typeof body.active === 'boolean') {
      if (body.active === false && row.role_code === 'OWNER') {
        const owners = (await dbAll(db, 'SELECT id FROM users WHERE role_code = ? AND (is_active = 1 OR is_active = TRUE)', 'OWNER')) as Array<{ id: number }>;
        if (owners.length <= 1) return forbidden(req.headers); // Нельзя отключить последнего Owner
      }
      updates.push('is_active = ?');
      values.push(body.active ? 1 : 0);
    }
    if (updates.length === 0) {
      return NextResponse.json({ id: `u_${row.id}`, email: row.email, role: toSpecRole(row.role_code), active: row.is_active !== undefined ? Boolean(row.is_active) : true, lastLoginAt: null });
    }
    const actorId = (session?.user?.id as string) ?? '0';
    if (String(row.id) === actorId && body.role && SPEC_TO_ROLE[body.role] !== row.role_code) {
      return badRequest('Cannot change your own role', req.headers);
    }
    const now = new Date().toISOString();
    values.push(now, userId);
    await dbRun(db, `UPDATE users SET ${updates.join(', ')}, updated_at = ? WHERE id = ?`, ...values);
    const updated = (await dbGet(db, 'SELECT id, email, role_code, is_active FROM users WHERE id = ?', userId)) as { id: number; email: string; role_code: string; is_active?: number };
    return NextResponse.json({ id: `u_${updated.id}`, email: updated.email, role: toSpecRole(updated.role_code), active: updated.is_active !== undefined ? Boolean(updated.is_active) : true, lastLoginAt: null });
  } catch (e) {
    console.error('[settings/users PATCH]', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.ADMIN_MANAGE_USERS);
  if (err) return err;
  const rawId = (await params).id;
  const userId = rawId.startsWith('u_') ? parseInt(rawId.slice(2), 10) : parseInt(rawId, 10);
  if (Number.isNaN(userId) || userId < 1) return badRequest('Invalid user id', req.headers);
  try {
    const db = await getDb();
    const row = (await dbGet(db, 'SELECT id, email, role_code FROM users WHERE id = ?', userId)) as { id: number; email: string; role_code: string } | undefined;
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (row.role_code === 'OWNER') {
      const owners = (await dbAll(db, 'SELECT id FROM users WHERE role_code = ?', 'OWNER')) as Array<{ id: number }>;
      if (owners.length <= 1) return forbidden(req.headers); // Запрещено удалять последнего Owner
    }
    await dbRun(db, 'DELETE FROM users WHERE id = ?', userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[settings/users DELETE]', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Delete failed' }, { status: 500 });
  }
}
