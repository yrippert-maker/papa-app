/**
 * Proxy to issue-ack-server (GET /ack/:fingerprint, POST /ack).
 * Set ACK_SERVER_URL (and ACK_API_KEY) in env to enable.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';

export const dynamic = 'force-dynamic';

const ACK_SERVER_URL = (process.env.ACK_SERVER_URL || '').trim();
const ACK_API_KEY = (process.env.ACK_API_KEY || '').trim();

async function proxyGet(fingerprint: string) {
  const res = await fetch(`${ACK_SERVER_URL.replace(/\/+$/, '')}/ack/${encodeURIComponent(fingerprint)}`, {
    headers: ACK_API_KEY ? { 'x-api-key': ACK_API_KEY } : {},
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function proxyPost(body: unknown) {
  const res = await fetch(`${ACK_SERVER_URL.replace(/\/+$/, '')}/ack`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(ACK_API_KEY ? { 'x-api-key': ACK_API_KEY } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

export async function GET(req: NextRequest): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.WORKSPACE_READ, req);
  if (err) return err;

  if (!ACK_SERVER_URL) {
    return NextResponse.json({ ok: false, error: 'Ack server not configured' }, { status: 503 });
  }

  const fp = req.nextUrl.searchParams.get('fingerprint')?.trim();
  if (!fp) {
    return NextResponse.json({ ok: false, error: 'missing fingerprint' }, { status: 400 });
  }

  const { status, json } = await proxyGet(fp);
  return NextResponse.json(json, { status });
}

export async function POST(req: NextRequest): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.LEDGER_APPEND, req);
  if (err) return err;

  if (!ACK_SERVER_URL) {
    return NextResponse.json({ ok: false, error: 'Ack server not configured' }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const { status, json } = await proxyPost(body);
  return NextResponse.json(json, { status });
}
