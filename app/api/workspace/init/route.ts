import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { ensureWorkspaceStructure } from '@/lib/workspace';
import { getDb } from '@/lib/db';
import { requirePermission, PERMISSIONS } from '@/lib/authz';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const err = requirePermission(session, PERMISSIONS.WORKSPACE_READ, req);
  if (err) return err;

  try {
    const { created } = ensureWorkspaceStructure();
    getDb(); // ensure DB + schema
    return NextResponse.json({ ok: true, created });
  } catch (e) {
    console.error('[workspace/init]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Init failed' },
      { status: 500 }
    );
  }
}
