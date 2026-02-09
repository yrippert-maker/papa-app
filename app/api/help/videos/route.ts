/**
 * GET /api/help/videos — FR-9.3/9.4: список видеоинструкций с версионированием.
 */
import { NextResponse } from 'next/server';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';

const CONFIG_PATH = join(process.cwd(), 'config', 'video-instructions.json');

export async function GET(): Promise<Response> {
  if (!existsSync(CONFIG_PATH)) {
    return NextResponse.json({ videos: [] });
  }
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf8');
    const data = JSON.parse(raw);
    const videos = Array.isArray(data?.videos) ? data.videos : [];
    return NextResponse.json({ videos });
  } catch {
    return NextResponse.json({ videos: [] });
  }
}
