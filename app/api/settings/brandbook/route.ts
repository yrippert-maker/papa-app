/**
 * GET/PATCH /api/settings/brandbook
 * Конфигурация брендбука (FR-1.5). Только ADMIN.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';

const CONFIG_PATH = join(process.cwd(), 'config', 'mura-menasa-brandbook.json');

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.ADMIN_MANAGE_USERS, null as unknown as Request);
  if (err) return err;

  if (!existsSync(CONFIG_PATH)) {
    return NextResponse.json({
      company: 'MURA MENASA FZCO',
      colors: { primary: '#EF1C23', primaryRgb: '239, 28, 35', text: '#1a1a1a', textSecondary: '#4a4a4a', background: '#ffffff' },
      typography: { fontFamily: 'Inter, system-ui, sans-serif', headingFont: 'Inter, system-ui, sans-serif' },
      logo: { path: '/mura-menasa-logo.png', alt: 'MURA MENASA FZCO' },
      templates: { firmBlank: 'templates/mura-menasa-firm-blank.docx' },
      documentRules: [],
    });
  }
  const data = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  return NextResponse.json(data);
}

const PatchBody = z.object({
  company: z.string().optional(),
  colors: z.object({
    primary: z.string().optional(),
    primaryRgb: z.string().optional(),
    text: z.string().optional(),
    textSecondary: z.string().optional(),
    background: z.string().optional(),
  }).optional(),
  typography: z.object({
    fontFamily: z.string().optional(),
    headingFont: z.string().optional(),
  }).optional(),
  logo: z.object({
    path: z.string().optional(),
    alt: z.string().optional(),
  }).optional(),
  templates: z.object({
    firmBlank: z.string().optional(),
  }).optional(),
  documentRules: z.array(z.string()).optional(),
});

export async function PATCH(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.ADMIN_MANAGE_USERS, request);
  if (err) return err;

  try {
    const body = PatchBody.parse(await request.json());
    const current = existsSync(CONFIG_PATH)
      ? JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
      : {};

    const updated = {
      ...current,
      ...(body.company !== undefined && { company: body.company }),
      ...(body.colors && { colors: { ...current.colors, ...body.colors } }),
      ...(body.typography && { typography: { ...current.typography, ...body.typography } }),
      ...(body.logo && { logo: { ...current.logo, ...body.logo } }),
      ...(body.templates && { templates: { ...current.templates, ...body.templates } }),
      ...(body.documentRules !== undefined && { documentRules: body.documentRules }),
    };

    const dir = join(process.cwd(), 'config');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2), 'utf8');

    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues }, { status: 400 });
    }
    console.error('[settings/brandbook]', e);
    return NextResponse.json({ error: 'Ошибка сохранения' }, { status: 500 });
  }
}
