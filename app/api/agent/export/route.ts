/**
 * POST /api/agent/export
 * Генерация DOCX из черновика (docxtemplater + pizzip).
 * Записывает артефакты в AGENT_OUTPUT_ROOT (document.docx, evidencemap.json, sha256.txt).
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { z } from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { getAgentDb } from '@/lib/agent/db';
import { buildAuditMeta } from '@/lib/agent/audit-meta';
import {
  resolveOutputDir,
  slugify,
  getAgentOutputRoot,
} from '@/lib/agent-output-paths';
import { rejectPathPayloads, requireJsonContentType, PathPayloadForbiddenError } from '@/lib/api/reject-path-payloads';
import { appendLedgerEvent } from '@/lib/ledger-hash';

const Body = z.object({
  draftId: z.string().min(1),
  format: z.literal('docx'),
  templateKey: z.enum(['letter', 'act', 'report', 'memo', 'techcard']).optional(),
  draftFields: z.record(z.string(), z.unknown()).optional(),
});

export const dynamic = 'force-dynamic';

function defaultFields(templateKey: string): Record<string, unknown> {
  const base = { org_name: 'ООО ПАПА', date: new Date().toISOString().slice(0, 10) };
  if (templateKey === 'techcard') {
    return {
      ...base,
      product: 'ТВ3-117',
      operation: '',
      version: '1.0',
      approval: '',
      input_control: '',
      steps: '',
      acceptance_criteria: '',
      sms_requirements: 'REQ:MM-SMS-§3.1',
      requirement_ref: 'REQ:MM-QM-§4.2',
    };
  }
  if (templateKey === 'act') {
    return {
      ...base,
      act_type: 'входного контроля',
      product: 'ТВ3-117',
      act_number: '',
      act_date: base.date,
      work_order: '',
      location: '',
      serial_number: '',
      part_number: '',
      modification: '',
      completeness: '',
      condition: '',
      decision: '',
      requirement_ref: 'REQ:EASA-145.A.50',
      version: '1.0',
      inspector: '', inspector_date: '',
      reviewer: '', reviewer_date: '',
      approver: '', approver_date: '',
    };
  }
  return { ...base, recipient: 'УКАЖИ АДРЕСАТА', items: [] };
}

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

    let templateKey = (body.templateKey ?? 'letter') as string;
    let draftFields: Record<string, unknown> = defaultFields(templateKey);
    let evidenceForAudit: Array<{ path: string; sha256: string; chunkIds: string[]; confidence?: number }> | undefined;

    if (process.env.DATABASE_URL) {
      const pool = await getAgentDb();
      const row = await pool.query(
        'SELECT template_key, draft_fields, status, evidence FROM agent_generated_documents WHERE id = $1',
        [body.draftId]
      );
      const doc = row.rows[0];
      const ev = (doc as { evidence?: unknown })?.evidence;
      evidenceForAudit = Array.isArray(ev)
        ? ev.map((e: { path?: string; sha256?: string; chunkIds?: string[]; confidence?: number }) => {
            const out: { path: string; sha256: string; chunkIds: string[]; confidence?: number } = {
              path: e.path ?? '',
              sha256: e.sha256 ?? '',
              chunkIds: Array.isArray(e.chunkIds) ? e.chunkIds : [],
            };
            if (typeof e.confidence === 'number' && !Number.isNaN(e.confidence)) {
              out.confidence = e.confidence;
            }
            return out;
          })
        : undefined;
      if (!doc) {
        return NextResponse.json({ error: 'Черновик не найден' }, { status: 404 });
      }
      const status = (doc.status ?? 'draft') as 'draft' | 'confirmed' | 'final';
      // Export только из confirmed (или final для повторного экспорта)
      if (status === 'draft') {
        return NextResponse.json(
          { error: 'Сначала подтвердите черновик (кнопка «Подтвердить»)', status },
          { status: 400 }
        );
      }
      templateKey = doc.template_key ?? 'letter';
      draftFields = { ...defaultFields(templateKey), ...(doc.draft_fields as Record<string, unknown>) };
    } else if (body.draftFields) {
      draftFields = { ...defaultFields(templateKey), ...body.draftFields };
    }

    const templateFile =
      templateKey === 'act' ? 'act.docx' : templateKey === 'techcard' ? 'techcard.docx' : 'letter.docx';
    const templatePath = path.join(process.cwd(), 'templates/docx', templateFile);
    let content: Buffer;
    try {
      content = await fs.readFile(templatePath);
    } catch {
      return NextResponse.json(
        { error: `Template not found: templates/docx/${templateFile}` },
        { status: 404 }
      );
    }

    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    doc.setData(draftFields);
    doc.render();

    const buf = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });

    const outputSha256 = crypto.createHash('sha256').update(buf).digest('hex');
    const auditMeta = buildAuditMeta('1.0', evidenceForAudit);

    let outputRelPath: string | null = null;
    let evidencemapSha256: string | null = null;
    const product = String(draftFields.product ?? 'общие');
    const slug =
      slugify(String(draftFields.act_number ?? draftFields.act_type ?? body.draftId)) ||
      body.draftId.slice(0, 8);
    const date = new Date().toISOString().slice(0, 10);
    const outDir = resolveOutputDir(product, 'docx', date, slug);

    if (outDir) {
      const docxPath = path.join(outDir, 'document.docx');
      const emPath = path.join(outDir, 'evidencemap.json');
      const shaPath = path.join(outDir, 'sha256.txt');
      const root = getAgentOutputRoot()!;
      outputRelPath = path.relative(root, docxPath);

      await fs.writeFile(docxPath, buf);
      const evidencemapContent = JSON.stringify(
        {
          draftId: body.draftId,
          product,
          templateKey,
          evidence: evidenceForAudit ?? [],
          auditMeta,
        },
        null,
        2
      );
      await fs.writeFile(emPath, evidencemapContent, 'utf-8');
      evidencemapSha256 = crypto.createHash('sha256').update(evidencemapContent, 'utf8').digest('hex');
      await fs.writeFile(shaPath, `${outputSha256}  document.docx\n`, 'utf-8');
      const manifestPath = path.join(outDir, 'sources_manifest.json');
      await fs.writeFile(
        manifestPath,
        JSON.stringify(
          {
            document: 'document.docx',
            sha256: outputSha256,
            sources: (evidenceForAudit ?? []).map((s) => ({ path: s.path, sha256: s.sha256 })),
          },
          null,
          2
        ),
        'utf-8'
      );
    }

    if (process.env.DATABASE_URL) {
      const pool = await getAgentDb();
      await pool.query(
        `UPDATE agent_generated_documents
         SET output_sha256 = $1, audit_meta = $2,
             output_docx_path = COALESCE($5, output_docx_path),
             status = CASE WHEN status = 'confirmed' THEN 'final' ELSE status END,
             finalized_at = CASE WHEN status = 'confirmed' THEN now() ELSE finalized_at END,
             finalized_by = CASE WHEN status = 'confirmed' THEN $3 ELSE finalized_by END
         WHERE id = $4 AND status IN ('confirmed', 'final')`,
        [outputSha256, JSON.stringify(auditMeta), userId, body.draftId, outputRelPath]
      );
    }

    await appendLedgerEvent({
      event_type: 'AGENT_EXPORT',
      user_id: userId,
      payload: {
        actor: userId,
        actor_email: session?.user?.email ?? null,
        timestamp: new Date().toISOString(),
        draft_id: body.draftId,
        output_relative_path: outputRelPath ?? null,
        sha256: outputSha256,
        evidencemap_sha256: evidencemapSha256,
        approval_record_id: body.draftId,
      },
    });

    const headers: Record<string, string> = {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="generated-${body.draftId}.docx"`,
      'X-Docx-Sha256': outputSha256,
    };

    return new NextResponse(new Uint8Array(buf), { headers });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues }, { status: 400 });
    }
    const err = e as Error & { code?: string };
    if (err.code === 'ETALONS_WRITE_DISABLED') {
      return NextResponse.json({ error: 'ETALONS_WRITE_DISABLED' }, { status: 403 });
    }
    if (e instanceof PathPayloadForbiddenError) {
      await appendLedgerEvent({
        event_type: 'PATH_PAYLOAD_FORBIDDEN',
        user_id: session?.user?.id ?? session?.user?.email ?? 'anonymous',
        payload: {
          actor: session?.user?.id ?? null,
          actor_email: session?.user?.email ?? null,
          endpoint: '/api/agent/export',
          forbidden_keys: e.forbiddenKeys,
          request_id: request.headers.get('x-request-id') ?? null,
        },
      });
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error('[agent/export]', e);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
