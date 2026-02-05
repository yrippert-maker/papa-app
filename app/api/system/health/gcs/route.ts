import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { requirePermission, PERMISSIONS } from "@/lib/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GCS-only health — отдельный роут, тянет @google-cloud/storage только при вызове. */
export async function GET(req: NextRequest): Promise<Response> {
  if (process.env.GCS_HEALTH_ENABLED !== "1") {
    return NextResponse.json(
      { error: "GCS health disabled (GCS_HEALTH_ENABLED≠1)" },
      { status: 503 }
    );
  }

  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.WORKSPACE_READ, req);
  if (err) return err;

  const { computeGcsHealth } = await import("@/lib/system/health/gcs-health");
  const h = await computeGcsHealth();
  const code = h.status === "fail" ? 503 : 200;
  return NextResponse.json(h, { status: code });
}
