import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { requirePermission, PERMISSIONS } from "@/lib/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Основной health без S3 — не импортирует storage-health, чтобы не тянуть AWS в bundle. */
export async function GET(req: NextRequest): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.WORKSPACE_READ, req);
  if (err) return err;

  const s3Msg =
    process.env.S3_HEALTH_ENABLED === "1"
      ? "S3: GET /api/system/health/s3"
      : "S3 disabled (S3_HEALTH_ENABLED≠1)";
  const gcsMsg =
    process.env.GCS_HEALTH_ENABLED === "1"
      ? "GCS: GET /api/system/health/gcs"
      : "GCS disabled (GCS_HEALTH_ENABLED≠1)";
  const s3On = process.env.S3_HEALTH_ENABLED === "1";
  const gcsOn = process.env.GCS_HEALTH_ENABLED === "1";
  const status = s3On || gcsOn ? ("ok" as const) : ("degraded" as const);
  const h = {
    version: 1 as const,
    generated_at: new Date().toISOString(),
    status,
    checks: [
      { name: "storage", ok: true, severity: "info" as const, message: `${s3Msg}; ${gcsMsg}` },
    ],
  };

  return NextResponse.json(h, { status: 200 });
}
