import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { badRequest } from '@/lib/api/error-response';
import { getDb, dbGet, dbRun } from '@/lib/db';

export const dynamic = 'force-dynamic';

type AllowedSenderRow = {
  id: number;
  sender_type: string;
  value: string;
  label: string;
  enabled: number;
  require_dmarc_pass_override: number | null;
  auto_analyze_override: number | null;
  require_approval_override: number | null;
  created_at: string;
};

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.SETTINGS_VIEW);
  if (err) return err;

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id) || id < 1) return badRequest('Invalid id', req.headers);

  try {
    const body = await req.json();
    const updates: string[] = [];
    const values: unknown[] = [];

    if (body.label !== undefined) {
      const label = String(body.label).trim();
      if (!label) return badRequest('label cannot be empty', req.headers);
      updates.push('label = ?');
      values.push(label);
    }
    if (body.enabled !== undefined) {
      updates.push('enabled = ?');
      values.push(body.enabled ? 1 : 0);
    }
    if (body.require_dmarc_pass !== undefined) {
      updates.push('require_dmarc_pass_override = ?');
      values.push(body.require_dmarc_pass ? 1 : 0);
    }
    if (body.auto_analyze !== undefined) {
      updates.push('auto_analyze_override = ?');
      values.push(body.auto_analyze ? 1 : 0);
    }
    if (body.require_approval !== undefined) {
      updates.push('require_approval_override = ?');
      values.push(body.require_approval ? 1 : 0);
    }

    if (updates.length === 0) {
      const row = (await dbGet(await getDb(), 'SELECT * FROM allowed_senders WHERE id = ?', id)) as AllowedSenderRow | undefined;
      if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({
        id: row.id,
        sender_type: row.sender_type,
        value: row.value,
        label: row.label,
        enabled: Boolean(row.enabled),
        require_dmarc_pass: row.require_dmarc_pass_override ?? true,
        auto_analyze: row.auto_analyze_override ?? true,
        require_approval: row.require_approval_override ?? true,
        created_at: row.created_at,
      });
    }

    values.push(id);
    const db = await getDb();
    await dbRun(db, `UPDATE allowed_senders SET ${updates.join(', ')} WHERE id = ?`, ...values);

    const row = (await dbGet(db, 'SELECT * FROM allowed_senders WHERE id = ?', id)) as AllowedSenderRow | undefined;
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({
      id: row.id,
      sender_type: row.sender_type,
      value: row.value,
      label: row.label,
      enabled: Boolean(row.enabled),
      require_dmarc_pass: row.require_dmarc_pass_override ?? true,
      auto_analyze: row.auto_analyze_override ?? true,
      require_approval: row.require_approval_override ?? true,
      created_at: row.created_at,
    });
  } catch (e) {
    console.error('[settings/sources PATCH]', e);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.SETTINGS_VIEW);
  if (err) return err;

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id) || id < 1) return badRequest('Invalid id', req.headers);

  try {
    const db = await getDb();
    const r = await dbRun(db, 'DELETE FROM allowed_senders WHERE id = ?', id);
    if (r.changes === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[settings/sources DELETE]', e);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
