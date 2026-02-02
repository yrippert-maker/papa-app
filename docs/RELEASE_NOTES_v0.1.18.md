# Release Notes v0.1.18 — Key revocation + Verification endpoint

## Summary

Завершение compliance-слоя подписи: revocation + verification API.

## Changes

- **Key revocation**: `revokeKey()`, `isKeyRevoked()`, `getKeyStatus()`
- **Auto-reject revoked keys**: `verifyExportHash()` отклоняет подписи отозванных ключей
- **Verification endpoint**: `POST /api/inspection/evidence/verify`
- **Error details**: `KEY_NOT_FOUND`, `KEY_REVOKED`, `SIGNATURE_INVALID`
- **AuthZ**: route count 23
- **Docs**: INSPECTION_API, ops/EVIDENCE_SIGNING, ENDPOINT_AUTHZ_EVIDENCE
- **Tests**: 208 passed (12 new tests)
