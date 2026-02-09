/**
 * POST /api/agent/draft
 * Подготовка черновика DOCX: draftFields, missingFields, evidence.
 * Evidence обогащается из agent_docs при DATABASE_URL.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { getAgentDb } from '@/lib/agent/db';
import { rejectPathPayloads, requireJsonContentType, PathPayloadForbiddenError } from '@/lib/api/reject-path-payloads';
import { appendLedgerEvent } from '@/lib/ledger-hash';

const BRANDBOOK_TEMPLATES: Record<string, string> = {
  'mura-menasa-firm-blank': '01_Фирменный_бланк_MM.docx',
  act: '02_АВК_шаблон_MM.docx',
  'act-output': '03_АВыхК_шаблон_MM.docx',
  techcard: '04_Техкарта_шаблон_MM.docx',
};

function getTemplatePath(intent: string): string | null {
  const filename = BRANDBOOK_TEMPLATES[intent];
  if (!filename) return null;
  return path.join(process.cwd(), 'templates', 'docx', 'brandbook', filename);
}

const Body = z.object({
  sessionId: z.string().optional(),
  intent: z.enum(['letter', 'act', 'act-output', 'report', 'memo', 'techcard', 'mura-menasa-firm-blank']),
  instructions: z.string().min(1),
  selectedDocIds: z.array(z.string()).default([]),
  docScores: z.record(z.string(), z.number()).optional(),
  extractedFromImage: z.record(z.string(), z.string()).optional(),
  /** Переопределение act_type для pipeline АВК → акт недостатков (FR-3.6). */
  actTypeOverride: z.string().optional(),
  /** FR-3.4: unit_id — связь карты с изделием (ТВ3-117, АИ-9, НР-3). */
  unitIdOverride: z.string().optional(),
});

export const dynamic = 'force-dynamic';

type EvidenceItem = {
  docId: string;
  path: string;
  sha256: string;
  chunkIds: string[];
  snippet?: string;
  confidence?: number;
};

async function enrichEvidence(
  docIds: string[],
  docScores?: Record<string, number>
): Promise<EvidenceItem[]> {
  try {
    const pool = await getAgentDb();
    const evidence: EvidenceItem[] = [];
    for (const docId of docIds) {
      const docRes = await pool.query(
        'SELECT path, sha256 FROM agent_docs WHERE id = $1',
        [docId]
      );
      const doc = docRes.rows[0];
      const chunkRes = await pool.query(
        'SELECT id, content FROM agent_doc_chunks WHERE doc_id = $1 ORDER BY idx LIMIT 1',
        [docId]
      );
      const firstChunk = chunkRes.rows[0];
      const confidence = docScores?.[docId];
      evidence.push({
        docId,
        path: doc?.path ?? '',
        sha256: doc?.sha256 ?? '',
        chunkIds: chunkRes.rows.map((r) => r.id),
        snippet: firstChunk?.content ? String(firstChunk.content).slice(0, 300) : undefined,
        ...(typeof confidence === 'number' && !Number.isNaN(confidence) && { confidence }),
      });
    }
    return evidence;
  } catch {
    return docIds.map((docId) => ({ docId, path: '', sha256: '', chunkIds: [] }));
  }
}

/** Rule-based extraction для auto-suggest missing_fields. */
function extractSuggestions(
  docIds: string[],
  getChunkContent: (docId: string) => Promise<string[]>
): Promise<Record<string, string>> {
  const suggestions: Record<string, string> = {};
  const patterns: Array<{ key: string; regex: RegExp; group?: number }> = [
    { key: 'serial_number', regex: /(?:S\/N|серийный\s*номер|№\s*изделия)[:\s]*([A-ZА-Я0-9\-/]+)/i },
    { key: 'serial_number', regex: /(?:P\/N|part\s*number)[:\s]*([A-Z0-9\-]+)/i },
    { key: 'act_number', regex: /(?:акт\s*№|№\s*акта|номер\s*акта)[:\s]*([A-Z0-9\-/]+)/i },
    { key: 'act_number', regex: /акт\s+([0-9]+(?:\/[0-9]+)?)/i },
    { key: 'inspector', regex: /(?:проверяющий|инспектор|ФИО)[:\s]+([А-Яа-яё\s\-]{3,50})/i },
    { key: 'approver', regex: /(?:утверждающий|утвердил)[:\s]+([А-Яа-яё\s\-]{3,50})/i },
    { key: 'operation', regex: /(?:операция|наименование)[:\s]+([А-Яа-яё0-9\s\-]{3,80})/i },
  ];

  return (async () => {
    let combined = '';
    for (const docId of docIds) {
      const chunks = await getChunkContent(docId);
      combined += chunks.join('\n') + '\n';
    }
    for (const { key, regex } of patterns) {
      if (suggestions[key]) continue;
      const m = combined.match(regex);
      if (m) {
        const val = (m[1] ?? m[0]).trim();
        if (val.length >= 2 && val.length <= 100) suggestions[key] = val;
      }
    }
    return suggestions;
  })();
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
    const sessionId = body.sessionId ?? nanoid();

    const hasDocs = body.selectedDocIds.length > 0;
    const hasExtracted = body.extractedFromImage && Object.keys(body.extractedFromImage).length > 0;
    if (!hasDocs && !hasExtracted) {
      return NextResponse.json(
        { error: 'Выберите документы или загрузите фото акта' },
        { status: 400 }
      );
    }

    const evidence =
      process.env.DATABASE_URL && body.selectedDocIds.length > 0
        ? await enrichEvidence(body.selectedDocIds, body.docScores)
        : body.selectedDocIds.map((docId) => {
            const confidence = body.docScores?.[docId];
            return {
              docId,
              path: '',
              sha256: '',
              chunkIds: [] as string[],
              ...(typeof confidence === 'number' && !Number.isNaN(confidence) && { confidence }),
            };
          });

    const isAct = body.intent === 'act' || body.intent === 'act-output';
    const isTechcard = body.intent === 'techcard';
    const isMuraMenasaFirmBlank = body.intent === 'mura-menasa-firm-blank';
    const templatePath = getTemplatePath(body.intent === 'letter' ? 'mura-menasa-firm-blank' : body.intent);
    const orgName = 'MURA MENASA FZCO';
    const draftFields = isMuraMenasaFirmBlank
      ? {
          org_name: orgName,
          date: new Date().toISOString().slice(0, 10),
          recipient: '',
          subject: '',
          items: [] as unknown[],
          act_type: 'входного контроля',
          product: 'ТВ3-117',
          act_number: '',
          act_date: new Date().toISOString().slice(0, 10),
          work_order: '',
          requirement_ref: 'REQ:EASA-145.A.50; AП-145',
        }
      : isTechcard
      ? {
          org_name: orgName,
          date: new Date().toISOString().slice(0, 10),
          product: body.unitIdOverride?.trim() || 'ТВ3-117',
          unit_id: body.unitIdOverride?.trim() || 'TV3-117',
          operation: '',
          version: '1.0',
          approval: '',
          input_control: '',
          steps: '',
          acceptance_criteria: '',
          sms_requirements: 'REQ:MM-SMS-§3.1',
          requirement_ref: 'REQ:MM-QM-§4.2; AП-145; EASA Part-145',
        }
      : isAct
      ? {
          org_name: orgName,
          date: new Date().toISOString().slice(0, 10),
          act_type: body.intent === 'act-output' ? (body.actTypeOverride?.trim() || 'выходного контроля') : (body.actTypeOverride?.trim() || 'входного контроля'),
          product: 'ТВ3-117',
          act_number: '',
          act_date: new Date().toISOString().slice(0, 10),
          work_order: '',
          location: '',
          serial_number: '',
          part_number: '',
          modification: '',
          completeness: '',
          condition: '',
          decision: '',
          requirement_ref: 'REQ:EASA-145.A.50; MOPM Mura Menasa; AП-145',
          version: '1.0',
          inspector: '',
          inspector_date: '',
          reviewer: '',
          reviewer_date: '',
          approver: '',
          approver_date: '',
        }
      : {
          org_name: orgName,
          date: new Date().toISOString().slice(0, 10),
          recipient: '',
          items: [] as unknown[],
        };
    const missingFieldsBase = isMuraMenasaFirmBlank
      ? [
          { key: 'recipient', question: 'Кому адресовано?' },
          { key: 'subject', question: 'Тема документа?' },
        ]
      : isTechcard
      ? [
          { key: 'operation', question: 'Название операции?' },
          { key: 'steps', question: 'Шаги операции (кратко)?' },
          { key: 'acceptance_criteria', question: 'Критерии приемки?' },
        ]
      : isAct
        ? [
            { key: 'serial_number', question: 'Серийный номер изделия (S/N)?' },
            { key: 'inspector', question: 'ФИО проверяющего?' },
            { key: 'approver', question: 'ФИО утверждающего?' },
          ]
        : [{ key: 'recipient', question: 'Кому адресовано письмо/документ?' }];

    let fieldSuggestions: Record<string, string> = { ...(body.extractedFromImage ?? {}) };
    if (process.env.DATABASE_URL && body.selectedDocIds.length > 0) {
      try {
        const pool = await getAgentDb();
        const getChunkContent = async (docId: string) => {
          const r = await pool.query(
            'SELECT content FROM agent_doc_chunks WHERE doc_id = $1 ORDER BY idx',
            [docId]
          );
          return r.rows.map((row) => String(row.content ?? ''));
        };
        const fromDocs = await extractSuggestions(body.selectedDocIds, getChunkContent);
        fieldSuggestions = { ...fromDocs, ...fieldSuggestions };
      } catch {
        // ignore
      }
    }

    const missingFields = missingFieldsBase.map((mf) => ({
      ...mf,
      suggestion: fieldSuggestions[mf.key],
    }));

    const draftFieldsWithSuggestions: Record<string, unknown> = { ...draftFields };
    for (const [key, val] of Object.entries(fieldSuggestions)) {
      if (val && (!draftFieldsWithSuggestions[key] || String(draftFieldsWithSuggestions[key]).trim() === '')) {
        draftFieldsWithSuggestions[key] = val;
      }
    }

    let draftId = nanoid();
    if (process.env.DATABASE_URL) {
      try {
        const pool = await getAgentDb();
        const r = await pool.query(
          `INSERT INTO agent_generated_documents (session_id, template_key, draft_fields, missing_fields, evidence, status)
           VALUES ($1::uuid, $2, $3, $4, $5, 'draft')
           RETURNING id`,
          [sessionId, body.intent, JSON.stringify(draftFieldsWithSuggestions), JSON.stringify(missingFields), JSON.stringify(evidence)]
        );
        draftId = r.rows[0]?.id ?? draftId;
      } catch {
        // fallback to nanoid
      }
    }

    return NextResponse.json({
      sessionId,
      draftId,
      templateKey: body.intent,
      templatePath: templatePath && existsSync(templatePath) ? templatePath : undefined,
      draftFields: draftFieldsWithSuggestions,
      missingFields,
      evidence,
      fieldSuggestions: Object.keys(fieldSuggestions).length > 0 ? fieldSuggestions : undefined,
      warnings: [
        'MVP: генерация полей — заглушка. Подключите модель/правила заполнения.',
        'Оформление: брендбук Mura Menasa (config/mura-menasa-brandbook.json).',
      ],
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
          endpoint: '/api/agent/draft',
          forbidden_keys: e.forbiddenKeys,
          request_id: request.headers.get('x-request-id') ?? null,
        },
      });
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error('[agent/draft]', e);
    return NextResponse.json({ error: 'Draft failed' }, { status: 500 });
  }
}
