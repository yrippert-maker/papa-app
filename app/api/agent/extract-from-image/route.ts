/**
 * POST /api/agent/extract-from-image
 * Извлечение полей из фото акта АВК/АВыхК (AI Vision) или placeholder.
 * Для Mura Menasa: распознавание S/N, P/N, инспектор, дата и т.д.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export const dynamic = 'force-dynamic';

type ExtractedFields = {
  serial_number?: string;
  part_number?: string;
  act_number?: string;
  inspector?: string;
  approver?: string;
  act_date?: string;
  work_order?: string;
  product?: string;
  completeness?: string;
  condition?: string;
  decision?: string;
};

async function extractWithOpenAI(buf: Buffer, mime: string): Promise<ExtractedFields> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return {};

  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey });
  const base64 = buf.toString('base64');

  const res = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 800,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Извлеки структурированные поля из фото акта входного или выходного контроля (АВК/АВыхК).
Верни ТОЛЬКО валидный JSON объект без markdown, с ключами:
serial_number, part_number, act_number, inspector, approver, act_date, work_order, product, completeness, condition, decision.
Используй пустую строку "" для отсутствующих полей. Даты в формате YYYY-MM-DD.`,
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mime};base64,${base64}`,
            },
          },
        ],
      },
    ],
  });

  const content = res.choices[0]?.message?.content?.trim();
  if (!content) return {};

  try {
    const parsed = JSON.parse(content) as Record<string, string>;
    const out: ExtractedFields = {};
    const keys: (keyof ExtractedFields)[] = [
      'serial_number', 'part_number', 'act_number', 'inspector', 'approver',
      'act_date', 'work_order', 'product', 'completeness', 'condition', 'decision',
    ];
    for (const k of keys) {
      const v = parsed[k];
      if (typeof v === 'string' && v.trim()) out[k] = v.trim();
    }
    return out;
  } catch {
    return {};
  }
}

export async function POST(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.FILES_LIST, request);
  if (err) return err;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'Missing file' }, { status: 400 });

    const mime = file.type?.toLowerCase();
    if (!IMAGE_TYPES.includes(mime)) {
      return NextResponse.json(
        { error: 'Только PNG, JPG, JPEG' },
        { status: 400 }
      );
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'Файл слишком большой (макс 10 MB)' },
        { status: 400 }
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const extracted = await extractWithOpenAI(buf, mime);

    return NextResponse.json({
      extracted,
      source: process.env.OPENAI_API_KEY ? 'openai-vision' : 'placeholder',
    });
  } catch (e) {
    console.error('[agent/extract-from-image]', e);
    return NextResponse.json(
      { error: 'Ошибка распознавания' },
      { status: 500 }
    );
  }
}
