/**
 * GET/POST /api/hr/vacations — FR-5.4–5.5: реестр отпусков.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermissionWithAlias, PERMISSIONS } from '@/lib/authz';
import { listVacations, addVacation, updateVacationStatus } from '@/lib/hr-service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const PostBody = z.object({
  employee: z.string().min(1),
  employeeEmail: z.string().optional(),
  role: z.string().optional(),
  start: z.string().min(1),
  end: z.string().min(1),
  status: z.enum(['Заявка', 'Утверждён', 'Отклонён']).default('Заявка'),
});

export async function GET(): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermissionWithAlias(session, PERMISSIONS.HR_VIEW, new Request('http://localhost'));
  if (err) return err;
  const items = listVacations();
  return NextResponse.json({ items });
}

export async function POST(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermissionWithAlias(session, PERMISSIONS.HR_MANAGE, request);
  if (err) return err;
  try {
    const raw = await request.json();
    const body = PostBody.parse(raw);
    const item = addVacation(body);
    return NextResponse.json(item);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid body', details: e.flatten() }, { status: 400 });
    }
    throw e;
  }
}

export async function PATCH(request: NextRequest): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermissionWithAlias(session, PERMISSIONS.HR_MANAGE, request);
  if (err) return err;
  try {
    const raw = await request.json();
    const { id, status } = z.object({
      id: z.string().min(1),
      status: z.enum(['Заявка', 'Утверждён', 'Отклонён']),
    }).parse(raw);
    const item = updateVacationStatus(id, status);
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(item);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid body', details: e.flatten() }, { status: 400 });
    }
    throw e;
  }
}
