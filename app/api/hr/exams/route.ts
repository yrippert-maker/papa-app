/**
 * GET/POST /api/hr/exams — FR-5.3: реестр экзаменов.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermissionWithAlias, PERMISSIONS } from '@/lib/authz';
import { listExams, addExam } from '@/lib/hr-service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const PostBody = z.object({
  competency: z.string().min(1),
  employee: z.string().min(1),
  employeeEmail: z.string().optional(),
  role: z.string().optional(),
  result: z.string().min(1),
  validUntil: z.string().min(1),
});

export async function GET(): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermissionWithAlias(session, PERMISSIONS.HR_VIEW, new Request('http://localhost'));
  if (err) return err;
  const items = listExams();
  return NextResponse.json({ items });
}

export async function POST(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermissionWithAlias(session, PERMISSIONS.HR_MANAGE, request);
  if (err) return err;
  try {
    const raw = await request.json();
    const body = PostBody.parse(raw);
    const item = addExam(body);
    return NextResponse.json(item);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid body', details: e.flatten() }, { status: 400 });
    }
    throw e;
  }
}
