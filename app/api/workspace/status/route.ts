import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { existsSync } from 'fs';
import { authOptions } from '@/lib/auth-options';
import { WORKSPACE_ROOT, DB_PATH, WORKSPACE_IS_EXPLICIT } from '@/lib/config';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { getDbReadOnly } from '@/lib/db';
import { hasDefaultAdminCredentials } from '@/lib/security-checks';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  const err = requirePermission(session, PERMISSIONS.WORKSPACE_READ);
  if (err) return err;

  if (process.env.NODE_ENV === 'production' && !process.env.E2E_MODE && hasDefaultAdminCredentials()) {
    console.error('[workspace/status] Production with default admin creds — fail fast');
    return NextResponse.json(
      { error: 'Server misconfiguration: change default admin@local password before production' },
      { status: 500 }
    );
  }

  const workspaceExists = existsSync(WORKSPACE_ROOT);
  const dbFileExists = existsSync(DB_PATH);
  let dbExists = false;
  let schemaReady = false;
  let filesRegistered = 0;
  let ledgerEvents = 0;
  let warning: string | undefined;
  let errorCode: string | undefined;

  if (dbFileExists) {
    try {
      const db = getDbReadOnly();
      const fr = db.prepare('SELECT COUNT(*) as c FROM file_registry').get() as { c: number };
      const le = db.prepare('SELECT COUNT(*) as c FROM ledger_events').get() as { c: number };
      dbExists = true;
      schemaReady = true;
      filesRegistered = fr?.c ?? 0;
      ledgerEvents = le?.c ?? 0;
    } catch (e) {
      const err = e as { code?: string; message?: string };
      errorCode = err?.code ?? (err?.message?.includes('no such table') ? 'SQLITE_ERROR_NO_TABLE' : undefined);
      warning = errorCode ? `db_unavailable: ${errorCode}` : 'db_unavailable';
      console.warn('[workspace/status] DB exists but read failed (init needed?):', err?.message ?? e);
    }
  }

  const body: Record<string, unknown> = {
    ok: true,
    workspaceRoot: WORKSPACE_ROOT,
    workspaceExists,
    dbExists,
    schemaReady,
    filesRegistered,
    ledgerEvents,
    workspaceConfigured: WORKSPACE_IS_EXPLICIT,
  };
  if (warning) body.warning = warning;
  if (errorCode) body.error_code = errorCode;
  return NextResponse.json(body);
}
