/**
 * GET/PATCH /api/settings/update-policies
 * Singleton: nested structure per SETTINGS API spec.
 * requireApproval cannot be turned off in pilot.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { badRequest } from '@/lib/api/error-response';
import { getDb, getDbReadOnly, dbGet, dbRun } from '@/lib/db';

export const dynamic = 'force-dynamic';

const TABLE_NAME = 'settings_update_policies';

function isTableMissing(e: unknown): boolean {
  const msg = String(e ?? '');
  return new RegExp(`relation ["']?${TABLE_NAME}["']? does not exist`, 'i').test(msg) ||
    new RegExp(`no such table: ${TABLE_NAME}`, 'i').test(msg);
}

type UpdatePoliciesRow = {
  id: number;
  email_poll_mode: string;
  email_poll_interval_min: number;
  regs_poll_mode: string;
  regs_poll_monthday: number | null;
  regs_schedule_hour?: number | null;
  auto_collect: number;
  auto_analyze: number;
  require_approval: number;
  auto_apply_after_approval: number;
  require_dmarc_pass: number;
  audit_enabled?: number | null;
  audit_retain_raw_days?: number | null;
  updated_by: string | null;
  updated_at: string;
};

function rowToNested(row: UpdatePoliciesRow | undefined) {
  if (!row) {
    return {
      email: {
        mode: 'scheduled' as const,
        intervalMin: 60,
        requireDmarcPass: true,
      },
      regulatory: {
        mode: 'scheduled' as const,
        schedule: { type: 'monthly' as const, day: 1, hour: 9 },
      },
      processing: {
        autoCollect: true,
        autoAnalyze: true,
        requireApproval: true,
        autoApplyAfterApproval: false,
      },
      audit: {
        enabled: true,
        retainRawDays: 365,
      },
    };
  }
  const emailMode = row.email_poll_mode === 'manual' ? 'manual' : 'scheduled';
  const regMode = row.regs_poll_mode === 'manual' ? 'manual' : 'scheduled';
  return {
    email: {
      mode: emailMode,
      intervalMin: row.email_poll_interval_min ?? 60,
      requireDmarcPass: Boolean(row.require_dmarc_pass),
    },
    regulatory: {
      mode: regMode,
      schedule: {
        type: (row.regs_poll_mode === 'weekly' ? 'weekly' : 'monthly') as 'weekly' | 'monthly',
        day: row.regs_poll_monthday ?? 1,
        hour: row.regs_schedule_hour ?? 9,
      },
    },
    processing: {
      autoCollect: Boolean(row.auto_collect),
      autoAnalyze: Boolean(row.auto_analyze),
      requireApproval: true, // pilot: cannot turn off
      autoApplyAfterApproval: Boolean(row.auto_apply_after_approval),
    },
    audit: {
      enabled: row.audit_enabled !== undefined ? Boolean(row.audit_enabled) : true,
      retainRawDays: row.audit_retain_raw_days ?? 365,
    },
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.SETTINGS_VIEW);
  if (err) return err;

  try {
    const db = await getDbReadOnly();
    const row = (await dbGet(db, `SELECT * FROM ${TABLE_NAME} WHERE id = 1`)) as UpdatePoliciesRow | undefined;
    return NextResponse.json(rowToNested(row));
  } catch (e) {
    if (isTableMissing(e)) {
      console.warn(`[settings/update-policies] ${TABLE_NAME} table missing. Run: npm run db:pg:migrate`);
      return NextResponse.json(rowToNested(undefined));
    }
    console.error('[settings/update-policies GET]', e);
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.SETTINGS_VIEW);
  if (err) return err;

  try {
    const body = await req.json();

    const email = body.email ?? {};
    const regulatory = body.regulatory ?? {};
    const processing = body.processing ?? {};
    const audit = body.audit ?? {};

    const email_poll_interval_min = Number(email.intervalMin) || 60;
    const email_poll_mode = email.mode === 'manual' ? 'manual' : (email_poll_interval_min <= 15 ? '15min' : email_poll_interval_min <= 60 ? 'hourly' : '3h');
    const regs_poll_mode = regulatory.mode === 'manual' ? 'manual' : (regulatory.schedule?.type === 'weekly' ? 'weekly' : 'monthly');
    const regs_poll_monthday = regulatory.schedule?.day ?? 1;
    const regs_schedule_hour = regulatory.schedule?.hour ?? 9;

    const auto_collect = processing.autoCollect !== false ? 1 : 0;
    const auto_analyze = processing.autoAnalyze !== false ? 1 : 0;
    const require_approval = 1; // pilot: cannot turn off
    const auto_apply_after_approval = processing.autoApplyAfterApproval === true ? 1 : 0;
    const require_dmarc_pass = email.requireDmarcPass !== false ? 1 : 0;
    const audit_enabled = audit.enabled !== false ? 1 : 0;
    const audit_retain_raw_days = Number(audit.retainRawDays) || 365;
    const updated_by = session?.user?.email ?? null;
    const now = new Date().toISOString();

    const db = await getDb();
    await dbRun(
      db,
      `UPDATE ${TABLE_NAME} SET
        email_poll_mode = ?, email_poll_interval_min = ?, regs_poll_mode = ?, regs_poll_monthday = ?,
        regs_schedule_hour = ?, auto_collect = ?, auto_analyze = ?, require_approval = ?, auto_apply_after_approval = ?, require_dmarc_pass = ?,
        audit_enabled = ?, audit_retain_raw_days = ?, updated_by = ?, updated_at = ?
      WHERE id = 1`,
      email_poll_mode === 'manual' ? 'manual' : (email_poll_interval_min <= 15 ? '15min' : email_poll_interval_min <= 60 ? 'hourly' : '3h'),
      email_poll_interval_min,
      regs_poll_mode,
      regs_poll_monthday,
      regs_schedule_hour,
      auto_collect,
      auto_analyze,
      require_approval,
      auto_apply_after_approval,
      require_dmarc_pass,
      audit_enabled,
      audit_retain_raw_days,
      updated_by,
      now
    );

    const row = (await dbGet(db, `SELECT * FROM ${TABLE_NAME} WHERE id = 1`)) as UpdatePoliciesRow | undefined;
    return NextResponse.json(rowToNested(row));
  } catch (e) {
    if (isTableMissing(e)) {
      console.warn(`[settings/update-policies] ${TABLE_NAME} table missing. Run: npm run db:pg:migrate`);
      return NextResponse.json(
        { error: 'Settings tables not initialized. Run: npm run db:pg:migrate' },
        { status: 503 }
      );
    }
    console.error('[settings/update-policies PATCH]', e);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
