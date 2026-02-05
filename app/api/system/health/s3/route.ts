import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { requirePermission, PERMISSIONS } from "@/lib/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** S3/storage health — отдельный роут, тянет AWS SDK только при вызове. */
export async function GET(req: NextRequest): Promise<Response> {
  if (process.env.S3_HEALTH_ENABLED !== "1") {
    return NextResponse.json(
      { error: "S3 health disabled (S3_HEALTH_ENABLED≠1)" },
      { status: 503 }
    );
  }

  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.WORKSPACE_READ, req);
  if (err) return err;

  const { computeS3Health } = await import("@/lib/system/health/s3-health");
  const h = await computeS3Health();
  const code = h.status === "fail" ? 503 : 200;
  return NextResponse.json(h, { status: code });
}
