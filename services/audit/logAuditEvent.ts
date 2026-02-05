/**
 * AuditEvent — единый хелпер записи аудит-событий.
 * Action: domain.verb (auth.sign_in, user.created, rbac.role_assigned, compliance.snapshot_created).
 * logAuditEventInTx — для записи в той же транзакции, что и CRUD (повышает корректность логов).
 */
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AuditMetadata = {
  requestId?: string;
  ip?: string;
  userAgent?: string;
  method?: string;
  path?: string;
  targetId?: string;
  diff?: unknown;
  [key: string]: unknown;
};

export type AuditParams = {
  actorUserId?: string | null;
  action: string;
  target?: string | null;
  metadata?: AuditMetadata | unknown;
};

export async function logAuditEvent(p: AuditParams): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      actorUserId: p.actorUserId ?? null,
      action: p.action,
      target: p.target ?? null,
      metadata: (p.metadata as object) ?? undefined,
    },
  });
}

/** Записать аудит-событие в той же транзакции, что и CRUD. */
export async function logAuditEventInTx(tx: Pick<PrismaClient, "auditEvent">, p: AuditParams): Promise<void> {
  await tx.auditEvent.create({
    data: {
      actorUserId: p.actorUserId ?? null,
      action: p.action,
      target: p.target ?? null,
      metadata: (p.metadata as object) ?? undefined,
    },
  });
}

/**
 * Извлечь metadata из Request (для API routes).
 * Не логирует секреты: Authorization, Cookie, токены — только безопасные заголовки.
 */
export function auditMetadataFromRequest(req: Request): AuditMetadata {
  const url = new URL(req.url);
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0]?.trim() : req.headers.get("x-real-ip") ?? undefined;
  return {
    requestId: req.headers.get("x-request-id") ?? undefined,
    ip: ip ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
    method: req.method,
    path: url.pathname,
  };
}

/** Сгенерировать requestId если отсутствует (для корреляции логов). */
export function getOrCreateRequestId(req: Request): string {
  return req.headers.get("x-request-id") ?? crypto.randomUUID();
}
