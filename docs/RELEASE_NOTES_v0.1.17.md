# Release Notes v0.1.17 — Key rotation support

## Summary

Поддержка ротации ключей: `key_id` для идентификации, архив публичных ключей для верификации старых экспортов.

## Changes

- **Key ID**: SHA-256 fingerprint публичного ключа (16 hex chars), включён в signed export
- **rotateKeys()**: архивирует текущий ключ, создаёт новый
- **listKeyIds()**: `{ active, archived }`
- **Directory structure**: `active/`, `archived/{key_id}/`
- **Migration**: автоматическая миграция legacy ключей
- **Docs**: ops/EVIDENCE_SIGNING.md обновлён
- **Tests**: 196 passed (key rotation test added)
