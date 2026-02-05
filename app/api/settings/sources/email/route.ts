/**
 * GET/POST /api/settings/sources/email
 * Allowlist: domain | email, camelCase per spec.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { badRequest } from '@/lib/api/error-response';
import { getDb, dbAll, dbGet, dbRun } from '@/lib/db';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';

type Row = {
  id: number;
  sender_type: string;
  value: string;
  label: string;
  enabled: number;
  require_dmarc_pass_override: number | null;
  auto_collect_override: number | null;
  auto_analyze_override: number | null;
  require_approval_override: number | null;
  created_at: string;
};

async function seedIfEmpty(db: Awaited<ReturnType<typeof getDb>>) {
  const c = (await dbGet(db, 'SELECT COUNT(*) as c FROM allowed_senders')) as { c: number } | undefined;
  if (c?.c && c.c > 0) return;
  const p = join(process.cwd(), 'config', 'inbox-sources.json');
  if (!existsSync(p)) return;
  try {
    const data = JSON.parse(readFileSync(p, 'utf8')) as { sources?: Array<{ domain?: string; email?: string; label: string; enabled?: boolean; require_dmarc_pass?: boolean; auto_analyze?: boolean; require_approval?: boolean }> };
    for (const s of data.sources ?? []) {
      const sender_type = s.email ? 'email' : 'domain';
      const value = (s.email ?? s.domain ?? '').trim().toLowerCase();
      if (!value || !s.label) continue;
      const enabled = s.enabled !== false ? 1 : 0;
      const rdp = s.require_dmarc_pass !== undefined ? (s.require_dmarc_pass ? 1 : 0) : null;
      const aa = s.auto_analyze !== undefined ? (s.auto_analyze ? 1 : 0) : null;
      const ra = s.require_approval !== undefined ? (s.require_approval ? 1 : 0) : null;
      try {
        await dbRun(db, `INSERT INTO allowed_senders (sender_type, value, label, enabled, require_dmarc_pass_override, auto_analyze_override, require_approval_override) VALUES (?, ?, ?, ?, ?, ?, ?)`, sender_type, value, s.label.trim(), enabled, rdp, aa, ra);
      } catch (e) {
        if (!String(e).includes('UNIQUE') && !String(e).includes('unique')) throw e;
      }
    }
  } catch (e) {
    console.warn('[settings/sources/email] seed failed', e);
  }
}

function toItem(r: Row) {
  return {
    id: String(r.id),
    type: r.sender_type as 'domain' | 'email',
    value: r.value,
    label: r.label,
    enabled: Boolean(r.enabled),
    requireDmarcPass: r.require_dmarc_pass_override ?? true,
    autoCollect: r.auto_collect_override ?? true,
    autoAnalyze: r.auto_analyze_override ?? true,
    requireApproval: r.require_approval_override ?? true,
    createdAt: r.created_at,
  };
}

export async function GET(): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.SETTINGS_VIEW);
  if (err) return err;
  try {
    const db = await getDb();
    await seedIfEmpty(db);
    const rows = (await dbAll(db, 'SELECT * FROM allowed_senders ORDER BY label')) as Row[];
    return NextResponse.json(rows.map(toItem));
  } catch (e) {
    console.error('[settings/sources/email GET]', e);
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 });
  }
}

export async function POST(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.SETTINGS_VIEW);
  if (err) return err;
  try {
    const body = await req.json();
    const type = (body.type ?? 'domain') as string;
    const value = String(body.value ?? '').trim().toLowerCase();
    const label = String(body.label ?? '').trim();
    if (!value || !label) return badRequest('value and label required', req.headers);
    if (type !== 'domain' && type !== 'email') return badRequest('type must be domain or email', req.headers);
    const enabled = body.enabled !== false ? 1 : 0;
    const requireDmarcPass = body.requireDmarcPass !== false ? 1 : null;
    const autoCollect = body.autoCollect !== false ? 1 : null;
    const autoAnalyze = body.autoAnalyze !== false ? 1 : null;
    const requireApproval = body.requireApproval !== false ? 1 : null;
    const db = await getDb();
    const r = await dbRun(db, `INSERT INTO allowed_senders (sender_type, value, label, enabled, require_dmarc_pass_override, auto_collect_override, auto_analyze_override, require_approval_override) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, type, value, label, enabled, requireDmarcPass, autoCollect, autoAnalyze, requireApproval);
    const row = r.lastInsertRowid ? (await dbGet(db, 'SELECT * FROM allowed_senders WHERE id = ?', r.lastInsertRowid)) as Row | undefined : undefined;
    if (!row) return NextResponse.json({ id: String(r.lastInsertRowid), type, value, label, enabled: Boolean(enabled) });
    return NextResponse.json(toItem(row));
  } catch (e) {
    console.error('[settings/sources/email POST]', e);
    return NextResponse.json({ error: 'Failed to add' }, { status: 500 });
  }
}
