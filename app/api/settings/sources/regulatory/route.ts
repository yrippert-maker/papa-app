/**
 * GET/POST /api/settings/sources/regulatory
 * ICAO | EASA | FAA | ARMAK, camelCase per spec.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { badRequest } from '@/lib/api/error-response';
import { getDb, getDbReadOnly, dbAll, dbGet, dbRun } from '@/lib/db';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

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

function isTableMissing(e: unknown): boolean {
  const msg = String(e ?? '');
  return /relation ["']?regulatory_sources["']? does not exist/i.test(msg) ||
    /no such table: regulatory_sources/i.test(msg);
}

/** Seed from config/mro-sources.json if regulatory_sources table empty */
async function seedFromConfig(db: Awaited<ReturnType<typeof getDb>>): Promise<boolean> {
  try {
    const c = (await dbGet(db, 'SELECT COUNT(*) as c FROM regulatory_sources')) as { c: number } | undefined;
    if (c?.c && c.c > 0) return true;
  } catch (e) {
    if (isTableMissing(e)) return false;
    throw e;
  }
  const p = join(process.cwd(), 'config', 'mro-sources.json');
  if (!existsSync(p)) return true;
  try {
    const data = JSON.parse(readFileSync(p, 'utf8')) as { sources?: Array<{ id: string; authority: string; kind: string; title: string; url: string }> };
    for (const s of data.sources ?? []) {
      const id = s.id ?? randomUUID();
      try {
        await dbRun(db, `INSERT INTO regulatory_sources (id, authority, url, title, enabled, download_mode, monitoring) VALUES (?, ?, ?, ?, 1, 'fulltext', 'monthly')`, id, s.authority, s.url, s.title ?? '');
      } catch (e) {
        if (!String(e).includes('UNIQUE') && !String(e).includes('unique')) throw e;
      }
    }
  } catch (e) {
    console.warn('[settings/sources/regulatory] seed failed', e);
  }
  return true;
}

export async function GET(): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.SETTINGS_VIEW);
  if (err) return err;
  try {
    const db = await getDb();
    const tableExists = await seedFromConfig(db);
    if (!tableExists) {
      console.warn('[settings/sources/regulatory] regulatory_sources table missing. Run: npm run db:pg:migrate');
      return NextResponse.json([]);
    }
    const rows = (await dbAll(db, 'SELECT * FROM regulatory_sources ORDER BY authority, id')) as Row[];
    return NextResponse.json(rows.map(toItem));
  } catch (e) {
    if (isTableMissing(e)) {
      console.warn('[settings/sources/regulatory] regulatory_sources table missing. Run: npm run db:pg:migrate');
      return NextResponse.json([]);
    }
    console.error('[settings/sources/regulatory GET]', e);
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 });
  }
}

export async function POST(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.SETTINGS_VIEW);
  if (err) return err;
  try {
    const body = await req.json();
    const authority = String(body.authority ?? '').toUpperCase();
    if (!AUTHORITIES.includes(authority)) return badRequest('authority must be ICAO | EASA | FAA | ARMAK', req.headers);
    const url = String(body.url ?? '').trim();
    if (!url) return badRequest('url required', req.headers);
    const docId = body.docId ? String(body.docId).trim() : null;
    const title = body.title ? String(body.title).trim() : null;
    const enabled = body.enabled !== false ? 1 : 0;
    const downloadMode = DOWNLOAD_MODES.includes(body.downloadMode) ? body.downloadMode : 'fulltext';
    const monitoring = MONITORING.includes(body.monitoring) ? body.monitoring : 'monthly';
    const id = body.id ? String(body.id).trim() : randomUUID();
    const now = new Date().toISOString();
    const db = await getDb();
    await dbRun(db, `INSERT INTO regulatory_sources (id, authority, doc_id, url, title, enabled, download_mode, monitoring, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, id, authority, docId, url, title, enabled, downloadMode, monitoring, now);
    const row = (await dbGet(db, 'SELECT * FROM regulatory_sources WHERE id = ?', id)) as Row | undefined;
    if (!row) return NextResponse.json({ id, authority, url, enabled: Boolean(enabled), downloadMode, monitoring });
    return NextResponse.json(toItem(row));
  } catch (e) {
    console.error('[settings/sources/regulatory POST]', e);
    return NextResponse.json({ error: 'Failed to add' }, { status: 500 });
  }
}
