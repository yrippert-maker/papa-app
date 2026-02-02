# Evidence Signing

## Назначение

Подпись `export_hash` при evidence export (Ed25519) для верификации целостности экспорта.

## Расположение ключей

`{WORKSPACE_ROOT}/00_SYSTEM/keys/`

- `evidence-signing.key` — приватный ключ (PEM, mode 0600)
- `evidence-signing.pub` — публичный ключ (PEM, mode 0644)

Ключи генерируются автоматически при первом запросе с `signed=1` или `format=bundle`.

## Использование

```
GET /api/inspection/cards/:id/evidence?signed=1
GET /api/inspection/cards/:id/evidence?format=bundle
```

При `format=bundle` возвращается ZIP с подписанным экспортом.

## Верификация

```bash
# export_hash из export.json
# signature из export.signature (hex)
# public key из public.pem

# Node.js:
const crypto = require('crypto');
const ok = crypto.verify(null, Buffer.from(exportHash, 'utf8'), publicKeyPem, Buffer.from(signatureHex, 'hex'));
```

## Безопасность

- Приватный ключ хранится только на сервере
- Регулярная ротация ключей — по политике организации
- При компрометации — перегенерировать ключи (удалить `evidence-signing.key` и `.pub`)
