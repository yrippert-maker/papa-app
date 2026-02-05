import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { ensureWorkspaceStructure } from '@/lib/workspace';
import { getDb } from '@/lib/db';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { rateLimitError } from '@/lib/api/error-response';
import { checkRateLimit, getClientKey } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const WRITE_RATE_LIMIT = { windowMs: 60_000, max: 10 };

export async function POST(req: Request): Promise<Response> {
  const key = `workspace-init:${getClientKey(req)}`;
  const { allowed, retryAfterMs } = checkRateLimit(key, WRITE_RATE_LIMIT);
  if (!allowed) {
    return rateLimitError(
      'Too many requests',
      req.headers,
      retryAfterMs ? Math.ceil(retryAfterMs / 1000) : undefined
    );
  }

  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.WORKSPACE_READ, req);
  if (err) return err;

  try {
    const { created } = ensureWorkspaceStructure();
    await getDb(); // ensure DB + schema
    return NextResponse.json({ ok: true, created });
  } catch (e) {
    console.error('[workspace/init]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Init failed' },
      { status: 500 }
    );
  }
}
