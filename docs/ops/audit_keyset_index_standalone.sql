-- Standalone SQL: keyset pagination index for AuditEvent
-- Use when Prisma migrate has drift and you cannot run prisma migrate deploy.
-- Safe to run: IF NOT EXISTS prevents duplicate index.
--
-- PostgreSQL:
--   psql "$DATABASE_URL" -f docs/ops/audit_keyset_index_standalone.sql
--
-- Or via node:
--   psql "$DATABASE_URL" -c "CREATE INDEX IF NOT EXISTS \"AuditEvent_createdAt_id_idx\" ON \"AuditEvent\"(\"createdAt\", \"id\");"

CREATE INDEX IF NOT EXISTS "AuditEvent_createdAt_id_idx" ON "AuditEvent"("createdAt", "id");
