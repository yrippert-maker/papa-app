-- Keyset pagination index for AuditEvent: ORDER BY createdAt DESC, id DESC
-- Improves performance for GET /api/audit/events with cursor-based pagination.
CREATE INDEX IF NOT EXISTS "AuditEvent_createdAt_id_idx" ON "AuditEvent"("createdAt", "id");
