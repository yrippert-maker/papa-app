/**
 * GET/POST /api/hr/training — FR-5.1–5.5: реестр обучения.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermissionWithAlias, PERMISSIONS } from '@/lib/authz';
import { listTraining, addTraining } from '@/lib/hr-service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const PostBody = z.object({
  program: z.string().min(1),
  employee: z.string().min(1),
  employeeEmail: z.string().optional(),
  role: z.string().optional(),
  date: z.string().min(1),
  cert: z.string().optional(),
});

export async function GET(): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermissionWithAlias(session, PERMISSIONS.HR_VIEW, new Request('http://localhost'));
  if (err) return err;
  const items = listTraining();
  return NextResponse.json({ items });
}

export async function POST(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermissionWithAlias(session, PERMISSIONS.HR_MANAGE, request);
  if (err) return err;
  try {
    const raw = await request.json();
    const body = PostBody.parse(raw);
    const item = addTraining(body);
    return NextResponse.json(item);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid body', details: e.flatten() }, { status: 400 });
    }
    throw e;
  }
}
