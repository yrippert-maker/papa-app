/**
 * GET /api/templates/export — NFR-1.2: экспорт шаблонов в PDF и HTML.
 * ?templateKey=letter|act|techcard|mura-menasa-firm-blank&format=pdf|html
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { jsPDF } from 'jspdf';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';

const TEMPLATE_KEYS = ['letter', 'act', 'techcard', 'mura-menasa-firm-blank'] as const;

function defaultFields(templateKey: string): Record<string, unknown> {
  const base = { org_name: 'ООО ПАПА', date: new Date().toISOString().slice(0, 10) };
  if (templateKey === 'mura-menasa-firm-blank') {
    return {
      org_name: 'MURA MENASA FZCO',
      date: base.date,
      recipient: 'Адресат',
      subject: 'Тема',
      act_type: 'входного контроля',
      product: 'ТВ3-117',
      act_number: 'АКТ-001',
      act_date: base.date,
      work_order: 'WO-2026-001',
      requirement_ref: 'REQ:EASA-145.A.50; АП-145',
    };
  }
  if (templateKey === 'techcard') {
    return {
      ...base,
      product: 'ТВ3-117',
      operation: 'Операция',
      version: '1.0',
      steps: 'Шаги выполнения',
      acceptance_criteria: 'Критерии приёмки',
      requirement_ref: 'REQ:MM-QM-§4.2',
    };
  }
  if (templateKey === 'act') {
    return {
      ...base,
      act_type: 'входного контроля',
      product: 'ТВ3-117',
      act_number: 'АКТ-001',
      act_date: base.date,
      work_order: 'WO-001',
      requirement_ref: 'REQ:EASA-145.A.50',
    };
  }
  return { ...base, recipient: 'Адресат', items: [] };
}

function buildHtml(templateKey: string, fields: Record<string, unknown>): string {
  const brandbookPath = join(process.cwd(), 'config', 'mura-menasa-brandbook.json');
  const primary = existsSync(brandbookPath)
    ? (JSON.parse(readFileSync(brandbookPath, 'utf8')) as { colors?: { primary?: string } }).colors?.primary ?? '#EF1C23'
    : '#EF1C23';
  const entries = Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `<tr><td>${k}</td><td>${String(Array.isArray(v) ? JSON.stringify(v) : v)}</td></tr>`)
    .join('');
  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"><title>Шаблон ${templateKey}</title>
<style>
body{font-family:Inter,system-ui,sans-serif;margin:24px;color:#1a1a1a}
h1{color:${primary};font-size:1.2em}
table{border-collapse:collapse;width:100%;max-width:600px}
th,td{border:1px solid #ddd;padding:8px;text-align:left}
th{background:${primary};color:#fff}
</style>
</head>
<body>
<h1>${String(fields.org_name ?? 'MURA MENASA FZCO')}</h1>
<p>Дата: ${String(fields.date ?? '')}</p>
<table><thead><tr><th>Поле</th><th>Значение</th></tr></thead><tbody>${entries}</tbody></table>
<p class="footer" style="margin-top:24px;font-size:0.9em;color:#4a4a4a">
Соответствие Руководству по качеству Mura Menasa. Экспорт шаблона (NFR-1.2).
</p>
</body>
</html>`;
}

function buildPdf(templateKey: string, fields: Record<string, unknown>): Buffer {
  const doc = new jsPDF({ unit: 'mm' });
  doc.setFontSize(14);
  doc.setTextColor(239, 28, 35);
  doc.text(String(fields.org_name ?? 'MURA MENASA FZCO'), 14, 14);
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`Шаблон: ${templateKey}`, 14, 22);
  doc.text(`Дата: ${String(fields.date ?? '')}`, 14, 28);

  const entries = Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .slice(0, 15);
  let y = 38;
  for (const [k, v] of entries) {
    const val = String(Array.isArray(v) ? JSON.stringify(v) : v).slice(0, 80);
    doc.text(`${k}: ${val}`, 14, y);
    y += 6;
  }
  doc.setFontSize(8);
  doc.text('Соответствие Руководству по качеству Mura Menasa. NFR-1.2.', 14, doc.internal.pageSize.height - 10);
  return Buffer.from(doc.output('arraybuffer'));
}

export async function GET(request: NextRequest): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.DOC_VIEW, request);
  if (err) return err;

  const { searchParams } = new URL(request.url);
  const templateKey = searchParams.get('templateKey') ?? 'letter';
  const format = searchParams.get('format') ?? 'html';

  if (!TEMPLATE_KEYS.includes(templateKey as (typeof TEMPLATE_KEYS)[number])) {
    return NextResponse.json(
      { error: `Invalid templateKey. Use: ${TEMPLATE_KEYS.join(', ')}` },
      { status: 400 }
    );
  }
  if (format !== 'pdf' && format !== 'html') {
    return NextResponse.json({ error: 'format must be pdf or html' }, { status: 400 });
  }

  const fields = defaultFields(templateKey);
  const date = new Date().toISOString().slice(0, 10);

  if (format === 'html') {
    const html = buildHtml(templateKey, fields);
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="template-${templateKey}-${date}.html"`,
      },
    });
  }

  const buf = buildPdf(templateKey, fields);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="template-${templateKey}-${date}.pdf"`,
    },
  });
}
