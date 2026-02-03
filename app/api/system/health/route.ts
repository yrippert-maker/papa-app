import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { requirePermission, PERMISSIONS } from "@/lib/authz";
import { computeSystemHealth } from "@/lib/system/storage-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const err = requirePermission(session, PERMISSIONS.WORKSPACE_READ, req);
  if (err) return err;
  const h = await computeSystemHealth();
  const code = h.status === "fail" ? 503 : 200;
  return NextResponse.json(h, { status: code });
}
