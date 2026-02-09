/**
 * POST /api/documents/finance/payments/export — FR-6.3: экспорт сводной таблицы в Excel/PDF.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { z } from 'zod';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const Body = z.object({
  format: z.enum(['xlsx', 'pdf']),
  items: z.array(
    z.object({
      payment_id: z.string(),
      date: z.string(),
      amount: z.number(),
      currency: z.string(),
      counterparty: z.string(),
      invoice: z.string().nullable(),
      bank_ref: z.string().nullable(),
    })
  ),
});

export const dynamic = 'force-dynamic';

type Item = z.infer<typeof Body>['items'][number];

function buildExcel(items: Item[]): Buffer {
  const ws = XLSX.utils.json_to_sheet(
    items.map((it) => ({
      Дата: it.date,
      Сумма: it.amount,
      Валюта: it.currency,
      Контрагент: it.counterparty,
      'Назначение платежа': it.invoice ?? '',
      'Банк. ref.': it.bank_ref ?? '',
    }))
  );
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Реестр платежей');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.from(buf);
}

function buildPdf(items: Item[]): Buffer {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm' });
  doc.setFontSize(10);
  doc.text('Реестр платежей — MURA MENASA FZCO', 14, 10);
  doc.text(`Сгенерировано: ${new Date().toLocaleString('ru-RU')}`, 14, 16);

  const headers = ['Дата', 'Сумма', 'Валюта', 'Контрагент', 'Назначение', 'Банк. ref.'];
  const rows = items.map((it) => [
    it.date,
    it.amount.toLocaleString('ru-RU'),
    it.currency,
    it.counterparty.slice(0, 30),
    (it.invoice ?? '').slice(0, 40),
    (it.bank_ref ?? '').slice(0, 20),
  ]);

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 22,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [239, 28, 35] },
    margin: { left: 14, right: 14 },
  });

  return Buffer.from(doc.output('arraybuffer'));
}

export async function POST(request: NextRequest): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.DOC_VIEW, request);
  if (err) return err;

  try {
    const raw = await request.json();
    const body = Body.parse(raw);

    if (body.items.length === 0) {
      return NextResponse.json({ error: 'Нет данных для экспорта' }, { status: 400 });
    }

    const sorted = [...body.items].sort((a, b) => b.date.localeCompare(a.date));

    if (body.format === 'xlsx') {
      const buf = buildExcel(sorted);
      const filename = `payments_${new Date().toISOString().slice(0, 10)}.xlsx`;
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    if (body.format === 'pdf') {
      const buf = buildPdf(sorted);
      const filename = `payments_${new Date().toISOString().slice(0, 10)}.pdf`;
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json({ error: 'Unknown format' }, { status: 400 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid body', details: e.flatten() }, { status: 400 });
    }
    throw e;
  }
}
