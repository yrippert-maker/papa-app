# Release v0.1.17 — Key rotation support (key_id)

## Overview
v0.1.17 добавляет поддержку ротации ключей: каждая подпись теперь включает
`key_id` для идентификации ключа, архивные ключи хранятся для верификации старых экспортов.

---

## Key Changes

### Key ID
- Каждый ключ имеет уникальный `key_id` — SHA-256 fingerprint публичного ключа (16 hex chars)
- `export_key_id` включён в signed export и manifest
- Верификация работает по `key_id` (находит нужный ключ автоматически)

### Key Rotation
- `rotateKeys()` — архивирует текущий ключ и создаёт новый
- `listKeyIds()` — возвращает `{ active, archived }`
- Архив: `{WORKSPACE_ROOT}/00_SYSTEM/keys/archived/{key_id}/`
- Приватный ключ НЕ архивируется (security best practice)

### New directory structure
```
keys/
├── active/
│   ├── evidence-signing.key
│   ├── evidence-signing.pub
│   └── key_id.txt
└── archived/
    └── {key_id}/
        ├── evidence-signing.pub
        └── archived_at.txt
```

### Migration
- Автоматическая миграция legacy ключей (pre-key_id) при первом запуске

### Documentation
- `docs/ops/EVIDENCE_SIGNING.md` — обновлён: key_id, rotation, directory structure

---

## Tests
- Key rotation test (sign with old key, rotate, verify old signature, sign with new)
- Total: **196 tests passed**
- Build: ✅
- E2E: signed export with key_id

---

## Release Artifacts
- `dist/regulatory-bundle-v0.1.17.zip`
- SHA-256: **abffb7f664b597504cba5adfe49a5766c588feb892a84519cb34c32d861f8226**
