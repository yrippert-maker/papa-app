/**
 * GET /api/audit/events — список AuditEvent с фильтрами и keyset pagination.
 * Требует: admin или auditor.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { requireRoleForApi } from "@/lib/requireRole";
import { prisma } from "@/lib/prisma";
import { encodeCursor } from "@/lib/pagination";

export const dynamic = "force-dynamic";

const MAX_LIMIT = 100;

function decodeAuditCursor(raw: string): { createdAt: Date; id: string } | null {
  if (!raw || raw.length > 512) return null;
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf-8");
    const [createdAt, id] = decoded.split("|");
    if (!createdAt || !id) return null;
    return { createdAt: new Date(createdAt), id };
  } catch {
    return null;
  }
}

function encodeAuditCursor(createdAt: Date, id: string): string {
  return encodeCursor(`${createdAt.toISOString()}|${id}`);
}

export async function GET(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = requireRoleForApi(session, ["admin", "auditor"], req);
  if (err) return err;

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const actorUserId = url.searchParams.get("actor");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const cursorRaw = url.searchParams.get("cursor");
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, MAX_LIMIT);

    const and: Array<Record<string, unknown>> = [];
    if (action) and.push({ action });
    if (actorUserId) and.push({ actorUserId });
    if (from || to) {
      const range: Record<string, Date> = {};
      if (from) range.gte = new Date(from);
      if (to) range.lte = new Date(to);
      and.push({ createdAt: range });
    }

    const cursor = cursorRaw ? decodeAuditCursor(cursorRaw) : null;
    if (cursor) {
      and.push({
        OR: [
          { createdAt: { lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { lt: cursor.id } },
        ],
      });
    }

    const where = and.length > 0 ? { AND: and } : {};

    const events = await prisma.auditEvent.findMany({
      where,
      take: limit + 1,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });

    const hasMore = events.length > limit;
    const items = hasMore ? events.slice(0, limit) : events;
    const last = items[items.length - 1];
    const nextCursor = hasMore && last ? encodeAuditCursor(last.createdAt, last.id) : null;

    return NextResponse.json({ events: items, nextCursor, hasMore });
  } catch (e) {
    console.error("[audit/events]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
