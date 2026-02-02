# Evidence Signing

## Назначение

Подпись `export_hash` при evidence export (Ed25519) для верификации целостности экспорта.

## Расположение ключей

`{WORKSPACE_ROOT}/00_SYSTEM/keys/`

```
keys/
├── active/
│   ├── evidence-signing.key   # приватный ключ (PEM, mode 0600)
│   ├── evidence-signing.pub   # публичный ключ (PEM, mode 0644)
│   └── key_id.txt             # идентификатор ключа (16 hex chars)
└── archived/
    └── {key_id}/
        ├── evidence-signing.pub  # архивный публичный ключ
        └── archived_at.txt       # дата архивации
```

Ключи генерируются автоматически при первом запросе с `signed=1` или `format=bundle`.

## Key ID

Каждый ключ имеет уникальный `key_id` — первые 16 символов SHA-256 хеша публичного ключа. Это позволяет:
- Идентифицировать, каким ключом подписан экспорт
- Поддерживать ротацию ключей без ломания верификации старых экспортов

## Использование

```
GET /api/inspection/cards/:id/evidence?signed=1
GET /api/inspection/cards/:id/evidence?format=bundle
```

Ответ включает:
- `export_signature` — hex подпись
- `export_key_id` — идентификатор ключа
- `export_public_key` — PEM публичный ключ

## Верификация

```javascript
// Node.js
const crypto = require('crypto');
const ok = crypto.verify(
  null,
  Buffer.from(exportHash, 'utf8'),
  publicKeyPem,
  Buffer.from(signatureHex, 'hex')
);
```

## Key Rotation

Ротация ключей выполняется программно:

```typescript
import { rotateKeys, listKeyIds } from '@/lib/evidence-signing';

// Создать новый ключ, архивировать старый
const { publicKey, keyId } = rotateKeys();

// Посмотреть все ключи
const { active, archived } = listKeyIds();
```

После ротации:
- Новые экспорты подписываются новым ключом
- Старые подписи верифицируются по `key_id` (публичный ключ хранится в `archived/{key_id}/`)
- Приватный ключ НЕ архивируется (security best practice)

## Key Revocation

Отзыв ключа (после ротации):

```typescript
import { revokeKey, isKeyRevoked, getKeyStatus } from '@/lib/evidence-signing';

// Отозвать архивный ключ
revokeKey(oldKeyId, 'compromised');

// Проверить статус
const revocation = isKeyRevoked(oldKeyId);
// { revoked: true, reason: 'compromised', revokedAt: '2026-...' }

const status = getKeyStatus(oldKeyId);
// { keyId, isActive: false, isRevoked: true, revocationInfo: {...} }
```

**ВАЖНО:** 
- Нельзя отозвать активный ключ (сначала `rotateKeys()`)
- `verifyExportHash` автоматически отклоняет подписи отозванных ключей
- Используйте `verifyExportHashWithDetails` для детальной информации об ошибке

## Evidence Verification Endpoint

```
POST /api/inspection/evidence/verify
```

Принимает:
- `export_json` — полный evidence export
- `signature` (опционально) — подпись, если нет в export_json
- `key_id` (опционально) — key_id, если нет в export_json

Возвращает:
- `ok` — общий результат
- `content.valid` — content hash совпадает
- `signature.valid` — подпись валидна
- `signature.error` — `KEY_NOT_FOUND`, `KEY_REVOKED`, `SIGNATURE_INVALID`
- `errors[]` — человекочитаемые ошибки

## Безопасность

- Приватный ключ хранится только на сервере (mode 0600)
- `key_id` позволяет отслеживать, каким ключом подписан каждый экспорт
- При компрометации — `rotateKeys()` + `revokeKey(oldId, 'compromised')`
- Регулярная ротация — по политике организации (рекомендуется: ежеквартально или при смене персонала)
