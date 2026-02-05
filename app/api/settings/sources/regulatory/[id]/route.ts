/**
 * PATCH/DELETE /api/settings/sources/regulatory/{id}
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { badRequest } from '@/lib/api/error-response';
import { getDb, dbGet, dbRun } from '@/lib/db';

export const dynamic = 'force-dynamic';

const AUTHORITIES = ['ICAO', 'EASA', 'FAA', 'ARMAK'];
const DOWNLOAD_MODES = ['fulltext', 'metadata'];
const MONITORING = ['weekly', 'monthly', 'manual'];

type Row = {
  id: string;
  authority: string;
  doc_id: string | null;
  url: string;
  title: string | null;
  enabled: number;
  download_mode: string;
  monitoring: string;
  created_at: string;
  updated_at: string;
};

function toItem(r: Row) {
  return {
    id: r.id,
    authority: r.authority,
    docId: r.doc_id ?? undefined,
    url: r.url,
    title: r.title ?? undefined,
    enabled: Boolean(r.enabled),
    downloadMode: r.download_mode as 'fulltext' | 'metadata',
    monitoring: r.monitoring as 'weekly' | 'monthly' | 'manual',
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.SETTINGS_VIEW);
  if (err) return err;
  const id = decodeURIComponent((await params).id);
  if (!id) return badRequest('Invalid id', req.headers);
  try {
    const body = await req.json();
    const updates: string[] = [];
    const values: unknown[] = [];
    if (body.authority !== undefined) {
      const authority = String(body.authority).toUpperCase();
      if (!AUTHORITIES.includes(authority)) return badRequest('authority must be ICAO | EASA | FAA | ARMAK', req.headers);
      updates.push('authority = ?');
      values.push(authority);
    }
    if (body.url !== undefined) {
      const url = String(body.url).trim();
      if (!url) return badRequest('url cannot be empty', req.headers);
      updates.push('url = ?');
      values.push(url);
    }
    if (body.docId !== undefined) {
      updates.push('doc_id = ?');
      values.push(body.docId ? String(body.docId).trim() : null);
    }
    if (body.title !== undefined) {
      updates.push('title = ?');
      values.push(body.title ? String(body.title).trim() : null);
    }
    if (body.enabled !== undefined) {
      updates.push('enabled = ?');
      values.push(body.enabled ? 1 : 0);
    }
    if (body.downloadMode !== undefined) {
      if (!DOWNLOAD_MODES.includes(body.downloadMode)) return badRequest('downloadMode must be fulltext | metadata', req.headers);
      updates.push('download_mode = ?');
      values.push(body.downloadMode);
    }
    if (body.monitoring !== undefined) {
      if (!MONITORING.includes(body.monitoring)) return badRequest('monitoring must be weekly | monthly | manual', req.headers);
      updates.push('monitoring = ?');
      values.push(body.monitoring);
    }
    if (updates.length === 0) {
      const row = (await dbGet(await getDb(), 'SELECT * FROM regulatory_sources WHERE id = ?', id)) as Row | undefined;
      if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json(toItem(row));
    }
    updates.push('updated_at = ?');
    values.push(new Date().toISOString(), id);
    const db = await getDb();
    await dbRun(db, `UPDATE regulatory_sources SET ${updates.join(', ')} WHERE id = ?`, ...values);
    const row = (await dbGet(db, 'SELECT * FROM regulatory_sources WHERE id = ?', id)) as Row | undefined;
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(toItem(row));
  } catch (e) {
    console.error('[settings/sources/regulatory PATCH]', e);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.SETTINGS_VIEW);
  if (err) return err;
  const id = decodeURIComponent((await params).id);
  if (!id) return badRequest('Invalid id', req.headers);
  try {
    const db = await getDb();
    const r = await dbRun(db, 'DELETE FROM regulatory_sources WHERE id = ?', id);
    if (r.changes === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[settings/sources/regulatory DELETE]', e);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
