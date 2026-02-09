/**
 * POST /api/agent/validate — валидация draftFields по правилам оформления (FR-1.3).
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { z } from 'zod';
import { validateDocument } from '@/lib/document-validation';

const Body = z.object({
  intent: z.enum(['act', 'techcard', 'mura-menasa-firm-blank', 'letter', 'report', 'memo']),
  draftFields: z.record(z.unknown()),
  documentRules: z.array(z.string()).optional(),
});

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.FILES_LIST, request);
  if (err) return err;

  try {
    const raw = await request.json();
    const body = Body.parse(raw);
    const result = validateDocument(
      body.intent,
      body.draftFields as Record<string, unknown>,
      body.documentRules
    );
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid body', details: e.flatten() }, { status: 400 });
    }
    throw e;
  }
}
