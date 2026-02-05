import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { badRequest } from '@/lib/api/error-response';
import { getDb, getDbReadOnly, dbAll, dbGet, dbRun } from '@/lib/db';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

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

/** Seed allowed_senders from config/inbox-sources.json if table is empty */
async function seedAllowedSendersIfEmpty(db: Awaited<ReturnType<typeof getDb>>) {
  const count = (await dbGet(db, 'SELECT COUNT(*) as c FROM allowed_senders')) as { c: number } | undefined;
  if (count && count.c > 0) return;

  const configPath = join(process.cwd(), 'config', 'inbox-sources.json');
  if (!existsSync(configPath)) return;

  try {
    const raw = readFileSync(configPath, 'utf8');
    const data = JSON.parse(raw) as { sources?: Array<{ domain?: string; email?: string; label: string; enabled?: boolean; require_dmarc_pass?: boolean; auto_analyze?: boolean; require_approval?: boolean }> };
    const sources = data.sources ?? [];
    for (const s of sources) {
      const sender_type = s.email ? 'email' : 'domain';
      const value = (s.email ?? s.domain ?? '').trim().toLowerCase();
      if (!value || !s.label) continue;
      const label = s.label.trim();
      const enabled = s.enabled !== false ? 1 : 0;
      const require_dmarc_pass_override = s.require_dmarc_pass !== undefined ? (s.require_dmarc_pass ? 1 : 0) : null;
      const auto_analyze_override = s.auto_analyze !== undefined ? (s.auto_analyze ? 1 : 0) : null;
      const require_approval_override = s.require_approval !== undefined ? (s.require_approval ? 1 : 0) : null;
      try {
        await dbRun(
          db,
          `INSERT INTO allowed_senders (sender_type, value, label, enabled, require_dmarc_pass_override, auto_analyze_override, require_approval_override)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          sender_type,
          value,
          label,
          enabled,
          require_dmarc_pass_override,
          auto_analyze_override,
          require_approval_override
        );
      } catch (e) {
        if (String(e).includes('UNIQUE') || String(e).includes('unique')) continue;
        throw e;
      }
    }
  } catch (e) {
    console.warn('[settings/sources] Seed from config failed:', e);
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.SETTINGS_VIEW);
  if (err) return err;

  try {
    const db = await getDb();
    await seedAllowedSendersIfEmpty(db);

    const rows = (await dbAll(db, 'SELECT * FROM allowed_senders ORDER BY label')) as AllowedSenderRow[];
    const emailSources = rows.map((r) => ({
      id: r.id,
      sender_type: r.sender_type,
      value: r.value,
      label: r.label,
      enabled: Boolean(r.enabled),
      require_dmarc_pass: r.require_dmarc_pass_override ?? true,
      auto_analyze: r.auto_analyze_override ?? true,
      require_approval: r.require_approval_override ?? true,
      created_at: r.created_at,
    }));

    let regSources: Array<{ id: string; authority: string; kind: string; title: string; url: string; notes?: string }> = [];
    const mroPath = join(process.cwd(), 'config', 'mro-sources.json');
    if (existsSync(mroPath)) {
      try {
        const raw = readFileSync(mroPath, 'utf8');
        const data = JSON.parse(raw) as { sources?: Array<{ id: string; authority: string; kind: string; title: string; url: string; notes?: string }> };
        regSources = data.sources ?? [];
      } catch {
        // ignore
      }
    }

    return NextResponse.json({ emailSources, regSources });
  } catch (e) {
    console.error('[settings/sources GET]', e);
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.SETTINGS_VIEW);
  if (err) return err;

  try {
    const body = await req.json();
    const sender_type = (body.sender_type ?? 'domain') as string;
    const value = String(body.value ?? '').trim().toLowerCase();
    const label = String(body.label ?? '').trim();
    if (!value || !label) return badRequest('value and label required', req.headers);
    if (sender_type !== 'domain' && sender_type !== 'email') return badRequest('sender_type must be domain or email', req.headers);

    const enabled = body.enabled !== false ? 1 : 0;
    const require_dmarc_pass = body.require_dmarc_pass !== false ? 1 : null;
    const auto_analyze = body.auto_analyze !== false ? 1 : null;
    const require_approval = body.require_approval !== false ? 1 : null;

    const db = await getDb();
    const r = await dbRun(
      db,
      `INSERT INTO allowed_senders (sender_type, value, label, enabled, require_dmarc_pass_override, auto_analyze_override, require_approval_override)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      sender_type,
      value,
      label,
      enabled,
      require_dmarc_pass,
      auto_analyze,
      require_approval
    );

    const id = r.lastInsertRowid;
    const row = (await dbGet(db, 'SELECT * FROM allowed_senders WHERE id = ?', id)) as AllowedSenderRow | undefined;
    if (!row) return NextResponse.json({ id, sender_type, value, label, enabled: Boolean(enabled) });
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
    console.error('[settings/sources POST]', e);
    return NextResponse.json({ error: 'Failed to add' }, { status: 500 });
  }
}
