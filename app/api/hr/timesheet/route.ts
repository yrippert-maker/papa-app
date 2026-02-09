/**
 * GET/POST /api/hr/timesheet — FR-5.4: табель рабочего времени с экспортом.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermissionWithAlias, PERMISSIONS } from '@/lib/authz';
import { listTimesheet, addTimesheet } from '@/lib/hr-service';
import { z } from 'zod';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

const PostBody = z.object({
  employee: z.string().min(1),
  employeeEmail: z.string().optional(),
  role: z.string().optional(),
  date: z.string().min(1),
  hours: z.number().min(0).max(24),
  activity: z.string().optional(),
  project: z.string().optional(),
});

export async function GET(request: NextRequest): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermissionWithAlias(session, PERMISSIONS.HR_VIEW, request);
  if (err) return err;

  const url = request.nextUrl;
  const format = url.searchParams.get('format');
  const employee = url.searchParams.get('employee') ?? undefined;
  const from = url.searchParams.get('from') ?? undefined;
  const to = url.searchParams.get('to') ?? undefined;

  const items = listTimesheet({ employee, from, to });

  if (format === 'xlsx') {
    const ws = XLSX.utils.json_to_sheet(
      items.map((i) => ({
        Сотрудник: i.employee,
        Дата: i.date,
        Часы: i.hours,
        Активность: i.activity ?? '',
        Проект: i.project ?? '',
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Табель');
    const buf = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    const filename = `timesheet_${new Date().toISOString().slice(0, 10)}.xlsx`;
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  }

  return NextResponse.json({ items });
}

export async function POST(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermissionWithAlias(session, PERMISSIONS.HR_MANAGE, request);
  if (err) return err;
  try {
    const raw = await request.json();
    const body = PostBody.parse(raw);
    const item = addTimesheet(body);
    return NextResponse.json(item);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid body', details: e.flatten() }, { status: 400 });
    }
    throw e;
  }
}
