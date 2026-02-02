# Release Notes v0.1.15 — Evidence export for Inspection cards

## Summary

Evidence export API для техкарт контроля: self-contained JSON snapshot с check_results, audit events и детерминированным export_hash (SHA-256).

## Changes

- **Evidence API**: `GET /api/inspection/cards/:id/evidence` — card snapshot + check_results + audit_events + export_hash
- **lib/inspection-evidence.ts**: buildEvidenceExport, canonicalizeForHash, computeExportHash
- **Error format**: 404/500 используют `{ error: { code, message, request_id } }`; добавлен NOT_FOUND, notFound()
- **Docs**: INSPECTION_API.md, ENDPOINT_AUTHZ_EVIDENCE.md
- **Tests**: 188 passed, E2E smoke для evidence endpoint
