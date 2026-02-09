/**
 * GET /api/hr/templates — FR-5.3: HR-шаблоны в стиле брендбука.
 * Возвращает список шаблонов с параметрами подстановки.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermissionWithAlias, PERMISSIONS } from '@/lib/authz';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';

const CONFIG_PATH = join(process.cwd(), 'config', 'hr-templates.json');

export async function GET(): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermissionWithAlias(session, PERMISSIONS.HR_VIEW, null as unknown as Request);
  if (err) return err;

  if (!existsSync(CONFIG_PATH)) {
    return NextResponse.json({
      templates: {},
      message: 'HR templates config not found. Add config/hr-templates.json',
    });
  }

  const data = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  return NextResponse.json(data);
}
