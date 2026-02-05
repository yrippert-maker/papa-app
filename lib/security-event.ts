/**
 * Security-event logging — срабатывание DB-инвариантов, отказ admin-операций.
 * Логирует в console (structured) и в AuditEvent для аудита.
 */
import { logAuditEvent } from "@/services/audit/logAuditEvent";

const LAST_ADMIN_MSG = "Cannot remove last admin";

export function isLastAdminBlockedError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.includes(LAST_ADMIN_MSG);
}

export type SecurityEventParams = {
  action: string;
  actorUserId?: string | null;
  target?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Логирует security-event: console (для алертов) + AuditEvent (для аудита).
 */
export async function logSecurityEvent(p: SecurityEventParams): Promise<void> {
  const line = `[SECURITY] ${p.action} actor=${p.actorUserId ?? "?"} target=${p.target ?? "?"}`;
  console.warn(line, p.metadata ?? "");

  try {
    await logAuditEvent({
      actorUserId: p.actorUserId ?? null,
      action: `security.${p.action}`,
      target: p.target ?? null,
      metadata: p.metadata,
    });
  } catch (err) {
    console.error("[security-event] logAuditEvent failed:", err);
  }
}
