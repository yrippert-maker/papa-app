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

  try {
    const workspaceExists = existsSync(WORKSPACE_ROOT);
    const dbExists = existsSync(DB_PATH);
    let filesRegistered = 0;
    let ledgerEvents = 0;
    if (dbExists) {
      const db = getDbReadOnly();
      const fr = db.prepare('SELECT COUNT(*) as c FROM file_registry').get() as { c: number };
      const le = db.prepare('SELECT COUNT(*) as c FROM ledger_events').get() as { c: number };
      filesRegistered = fr?.c ?? 0;
      ledgerEvents = le?.c ?? 0;
    }
    return NextResponse.json({
      workspaceRoot: WORKSPACE_ROOT,
      workspaceExists,
      dbExists,
      filesRegistered,
      ledgerEvents,
      workspaceConfigured: WORKSPACE_IS_EXPLICIT,
    });
  } catch (e) {
    console.error('[workspace/status]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Status failed' },
      { status: 500 }
    );
  }
}
