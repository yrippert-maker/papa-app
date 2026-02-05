/**
 * Пример API с RBAC (requireRoleForApi) и аудитом (logAuditEvent).
 * GET — список последних AuditEvent (только admin/auditor).
 * POST — создание тестового события (только admin).
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { requireRoleForApi } from "@/lib/requireRole";
import { logAuditEvent, auditMetadataFromRequest, getOrCreateRequestId } from "@/services/audit/logAuditEvent";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = requireRoleForApi(session, ["admin", "auditor"], req);
  if (err) return err;

  try {
    const events = await prisma.auditEvent.findMany({
      take: 20,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ events });
  } catch (e) {
    console.error("[admin/audit-example GET]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = requireRoleForApi(session, "admin", req);
  if (err) return err;

  try {
    const body = await req.json().catch(() => ({}));
    const action = (body.action as string) || "example.create";
    const target = (body.target as string) ?? null;
    const requestId = getOrCreateRequestId(req);
    const meta = auditMetadataFromRequest(req);

    await logAuditEvent({
      actorUserId: session!.user!.id!,
      action,
      target,
      metadata: { ...meta, requestId, source: "audit-example-api" },
    });

    return NextResponse.json({ ok: true, action, target, requestId });
  } catch (e) {
    console.error("[admin/audit-example POST]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
