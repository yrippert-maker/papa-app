# Release Notes v0.1.16 — Signed evidence export & bundle

## Summary

Подпись `export_hash` (Ed25519) + evidence bundle (ZIP) с manifest и публичным ключом.

## Changes

- **Signed export**: `?signed=1` — `export_signature` (hex), `export_public_key`
- **Bundle**: `?format=bundle` — ZIP: export.json, export.signature, manifest.json, public.pem
- **lib/evidence-signing.ts**: ensureKeys, signExportHash, verifyExportHash
- **Dependency**: jszip (ZIP creation)
- **Docs**: INSPECTION_API.md, ops/EVIDENCE_SIGNING.md
- **Tests**: 195 passed (unit + E2E)
