/**
 * RBAC audit — логирование rbac.access_denied с sampling.
 * Ограничение шума: 1% событий (иначе заспамит при массовых 403).
 */
import { logAuditEvent } from "@/services/audit/logAuditEvent";

const SAMPLE_RATE = 0.01; // 1%

export function shouldSampleRbacDenied(): boolean {
  return Math.random() < SAMPLE_RATE;
}

export async function logRbacAccessDeniedIfSampled(params: {
  request?: Request | null;
  actorUserId: string | null;
  permission?: string;
  requiredRoles?: string[];
  path?: string;
}): Promise<void> {
  if (!shouldSampleRbacDenied()) return;

  const url = params.request ? new URL(params.request.url) : null;
  const path = params.path ?? url?.pathname ?? "unknown";
  const requestId = params.request?.headers?.get("x-request-id") ?? undefined;

  try {
    await logAuditEvent({
      actorUserId: params.actorUserId,
      action: "rbac.access_denied",
      target: path,
      metadata: {
        requestId,
        permission: params.permission,
        requiredRoles: params.requiredRoles,
        path,
      },
    });
  } catch (e) {
    console.warn("[rbac-audit] logAuditEvent failed:", e);
  }
}
