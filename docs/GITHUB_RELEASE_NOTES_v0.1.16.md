# Release v0.1.16 — Signed evidence export & bundle (Ed25519)

## Overview
v0.1.16 усиливает evidence export: добавляет подпись `export_hash` (Ed25519) и
экспорт evidence bundle (ZIP) с manifest и публичным ключом для оффлайн-верификации.

---

## Key Changes

### Signed evidence export
- `GET /api/inspection/cards/:id/evidence?signed=1`
  - добавляет `export_signature` (hex) и `export_public_key`
- Key management:
  - ключи создаются при первом использовании в `{WORKSPACE_ROOT}/00_SYSTEM/keys/`
  - `evidence-signing.key` (private, mode 0600), `evidence-signing.pub` (public, mode 0644)
- Верификация:
  - `verifyExportHash(hash, sig, publicKey?)`

### Evidence bundle (ZIP)
- `GET /api/inspection/cards/:id/evidence?format=bundle`
  - возвращает ZIP:
    - `export.json` — полный evidence export
    - `export.signature` — подпись `export_hash` (hex)
    - `manifest.json` — SHA-256 по файлам (`export.json`, `export.signature`)
    - `public.pem` — публичный ключ
- Dependency: `jszip`

### Documentation
- `docs/INSPECTION_API.md` — параметры `signed=1` и `format=bundle`
- `docs/ops/EVIDENCE_SIGNING.md` — ключи, использование, верификация

---

## Tests
- Unit: key creation/sign/verify (5 cases)
- API: signed=1 and format=bundle
- E2E smoke: evidence?signed=1
- Total: **195 tests passed**
- Build: ✅
- E2E: ✅

---

## Release Artifacts
- `dist/regulatory-bundle-v0.1.16.zip`
- SHA-256: **a72ef9cfecb4a50e153fa8c8e25327f09af8630a357bdd4a122fa544b56bf990**
