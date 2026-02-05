/**
 * DELETE /api/agent/doc/:docId/override
 * Сброс оверлея правок (возврат к оригиналу). RBAC: DOC.EDIT.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { getAgentDb } from '@/lib/agent/db';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(s: string): boolean {
  return typeof s === 'string' && UUID_REGEX.test(s);
}

export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ docId: string }> }
): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.DOC_EDIT, _request);
  if (err) return err;

  const { docId } = await params;
  if (!isValidUuid(docId)) {
    return NextResponse.json({ error: 'Invalid docId format (expected UUID)' }, { status: 400 });
  }
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'DATABASE_URL required' }, { status: 400 });
    }

    const pool = await getAgentDb();
    const docCheck = await pool.query('SELECT id FROM agent_docs WHERE id = $1', [docId]);
    if (docCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const del = await pool.query('DELETE FROM agent_doc_override WHERE doc_id = $1 RETURNING doc_id', [docId]);
    if (del.rowCount === 0) {
      return NextResponse.json({ ok: true, message: 'No override to remove' });
    }

    return NextResponse.json({ ok: true, message: 'Override removed' });
  } catch (e) {
    console.error('[agent/doc override DELETE]', e);
    return NextResponse.json({ error: 'Failed to remove override' }, { status: 500 });
  }
}
