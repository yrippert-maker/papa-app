# Release v0.1.18 — Key revocation + Evidence verification endpoint

## Overview
v0.1.18 завершает compliance-слой подписи evidence exports:
- Key revocation: возможность отзыва скомпрометированных ключей
- Verification endpoint: API для проверки content hash и подписи

---

## Key Changes

### Key Revocation
- `revokeKey(keyId, reason)` — отзыв архивного ключа с указанием причины
- `isKeyRevoked(keyId)` — проверка статуса отзыва
- `getKeyStatus(keyId)` — полный статус ключа (active/archived/revoked)
- `verifyExportHash()` автоматически отклоняет подписи отозванных ключей
- `verifyExportHashWithDetails()` возвращает детальную информацию об ошибке

### Revocation storage
```
keys/archived/{key_id}/revoked.json
{
  "revoked": true,
  "reason": "compromised",
  "revokedAt": "2026-02-02T..."
}
```

### Evidence Verification Endpoint
- `POST /api/inspection/evidence/verify`
- Permission: `INSPECTION.VIEW`
- Принимает: `export_json`, `signature?`, `key_id?`
- Возвращает:
  - `ok` — общий результат
  - `content.valid` — content hash совпадает
  - `signature.valid` — подпись валидна
  - `signature.error` — `KEY_NOT_FOUND`, `KEY_REVOKED`, `SIGNATURE_INVALID`
  - `errors[]` — человекочитаемые ошибки

### AuthZ / route registry
- Добавлен `POST /api/inspection/evidence/verify`
- Route count: 23

### Documentation
- `docs/INSPECTION_API.md` — verify endpoint
- `docs/ops/EVIDENCE_SIGNING.md` — revocation, verification endpoint
- `docs/ENDPOINT_AUTHZ_EVIDENCE.md` — verify endpoint

---

## Tests
- Key revocation: 4 new tests (revoke, verify rejects revoked, details, cannot revoke active)
- Evidence verify endpoint: 8 new tests
- E2E: verify signed export
- Total: **208 tests passed**
- Build: ✅

---

## Release Artifacts
- `dist/regulatory-bundle-v0.1.18.zip`
- SHA-256: **<ADD_SHA256_HERE>**
