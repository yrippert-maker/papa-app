import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getDbReadOnly } from '@/lib/db';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { verifyLedgerChain } from '@/lib/ledger-hash';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  const err = requirePermission(session, PERMISSIONS.LEDGER_READ);
  if (err) return err;

  try {
    const db = getDbReadOnly();
    const rows = db
      .prepare(
        'SELECT event_type, payload_json, prev_hash, block_hash, created_at, actor_id FROM ledger_events ORDER BY id'
      )
      .all() as Array<{ event_type: string; payload_json: string; prev_hash: string | null; block_hash: string; created_at?: string; actor_id?: string | null }>;

    verifyLedgerChain(rows);
    return NextResponse.json({ ok: true, message: 'Ledger integrity: OK' });
  } catch (e) {
    console.error('[ledger/verify]', e);
    const msg = e instanceof Error ? e.message : 'Ledger verification failed';
    const isIntegrity = /chain break|hash mismatch/i.test(msg);
    return NextResponse.json(
      { error: msg },
      { status: isIntegrity ? 409 : 500 }
    );
  }
}
