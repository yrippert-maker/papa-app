/**
 * POST /api/agent/ingest
 * Поставить документ в очередь индексации.
 * Body: { docId: string }
 * RBAC: FILES.LIST (или DOC.EDIT)
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { enqueueAgentIngestJob } from '@/lib/agent/ingest-queue';

export const dynamic = 'force-dynamic';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.FILES_LIST, request);
  if (err) return err;

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_URL required' }, { status: 503 });
  }

  let body: { docId?: string };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const docId = body?.docId;
  if (!docId || typeof docId !== 'string' || !UUID_REGEX.test(docId)) {
    return NextResponse.json({ error: 'docId (UUID) required' }, { status: 400 });
  }

  try {
    const queued = await enqueueAgentIngestJob(docId);
    if (!queued) {
      return NextResponse.json({ error: 'Document not found or failed to queue' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, docId, message: 'Queued for indexing' });
  } catch (e) {
    console.error('[agent/ingest]', e);
    return NextResponse.json({ error: 'Failed to queue' }, { status: 500 });
  }
}
