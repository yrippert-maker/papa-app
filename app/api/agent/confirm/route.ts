/**
 * POST /api/agent/confirm
 * Подтверждение черновика: draft → confirmed.
 * Сохраняет пользовательские draft_fields и переводит статус.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { z } from 'zod';
import { getAgentDb } from '@/lib/agent/db';
import { canTransition } from '@/lib/agent/draft-workflow';
import { buildAuditMeta } from '@/lib/agent/audit-meta';
import { rejectPathPayloads, requireJsonContentType, PathPayloadForbiddenError } from '@/lib/api/reject-path-payloads';
import { appendLedgerEvent } from '@/lib/ledger-hash';

const Body = z.object({
  draftId: z.string().min(1),
  draftFields: z.record(z.string(), z.unknown()),
});

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.FILES_LIST, request);
  if (err) return err;
  const ctErr = requireJsonContentType(request);
  if (ctErr) return ctErr;

  try {
    const raw = await request.json();
    rejectPathPayloads(raw);
    const body = Body.parse(raw);
    const userId = session?.user?.id ?? session?.user?.email ?? 'anonymous';

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({
        ok: true,
        status: 'confirmed',
        message: 'БД не настроена — подтверждение в клиенте',
      });
    }

    const pool = await getAgentDb();
    const row = await pool.query(
      'SELECT id, status, draft_fields, evidence FROM agent_generated_documents WHERE id = $1',
      [body.draftId]
    );
    const doc = row.rows[0];
    if (!doc) {
      return NextResponse.json({ error: 'Черновик не найден' }, { status: 404 });
    }

    const currentStatus = (doc.status ?? 'draft') as 'draft' | 'confirmed' | 'final';

    // Идемпотентность: уже confirmed — возвращаем успех без изменений
    if (currentStatus === 'confirmed') {
      return NextResponse.json({
        ok: true,
        status: 'confirmed',
        draftId: body.draftId,
        message: 'Уже подтверждён',
      });
    }

    if (!canTransition(currentStatus, 'confirmed')) {
      return NextResponse.json(
        { error: `Недопустимый переход: ${currentStatus} → confirmed` },
        { status: 400 }
      );
    }

    const evidence = (doc as { evidence?: unknown }).evidence;
    const sources = Array.isArray(evidence)
      ? evidence.map((e: { path?: string; sha256?: string; chunkIds?: string[] }) => ({
          path: e.path ?? '',
          sha256: e.sha256 ?? '',
          chunkIds: Array.isArray(e.chunkIds) ? e.chunkIds : [],
        }))
      : undefined;
    const auditMeta = buildAuditMeta(undefined, sources);

    // Concurrency lock: UPDATE только если status='draft'
    const upd = await pool.query(
      `UPDATE agent_generated_documents
       SET status = 'confirmed', draft_fields = $1, confirmed_at = now(), confirmed_by = $2, audit_meta = $3
       WHERE id = $4 AND status = 'draft'
       RETURNING id`,
      [JSON.stringify(body.draftFields), userId, JSON.stringify(auditMeta), body.draftId]
    );

    if (upd.rowCount === 0) {
      // Гонка: другой запрос уже обновил — перечитаем и вернём текущий статус
      const recheck = await pool.query(
        'SELECT status FROM agent_generated_documents WHERE id = $1',
        [body.draftId]
      );
      const s = recheck.rows[0]?.status ?? 'draft';
      return NextResponse.json({
        ok: true,
        status: s,
        draftId: body.draftId,
        message: s === 'confirmed' ? 'Уже подтверждён (concurrent)' : undefined,
      });
    }

    return NextResponse.json({
      ok: true,
      status: 'confirmed',
      draftId: body.draftId,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues }, { status: 400 });
    }
    if (e instanceof PathPayloadForbiddenError) {
      await appendLedgerEvent({
        event_type: 'PATH_PAYLOAD_FORBIDDEN',
        user_id: session?.user?.id ?? session?.user?.email ?? 'anonymous',
        payload: {
          actor: session?.user?.id ?? null,
          actor_email: session?.user?.email ?? null,
          endpoint: '/api/agent/confirm',
          forbidden_keys: e.forbiddenKeys,
          request_id: request.headers.get('x-request-id') ?? null,
        },
      });
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error('[agent/confirm]', e);
    return NextResponse.json({ error: 'Confirm failed' }, { status: 500 });
  }
}
