# Интеграция IDEMIA — валидация по распознаванию лиц

## Обзор

IDEMIA Identity Proofing предоставляет верификацию личности по документам и распознаванию лиц (Document + Selfie). Интеграция с ПАПА позволяет использовать IDEMIA как альтернативу WebAuthn (отпечаток) для подписания документов.

**API:** https://experience.idemia.com/identity-proofing/develop/identity-proofing-verification/api-docs

## Конфигурация

### 1. Переменные окружения

```env
IDEMIA_IDENTITY_PROOFING_URL=https://api.idemia.example.com
IDEMIA_API_KEY=your-api-key
```

API key и base URL получаются в [IDEMIA Experience Portal](https://experience.idemia.com).

### 2. config/ecp-biometric.json

```json
{
  "enabled": true,
  "provider": "idemia",
  "allowedRoles": ["ADMIN", "MANAGER", "ENGINEER"],
  "idemia": { "enabled": true }
}
```

### 3. config/idemia.example.json

Скопировать в `config/idemia.json` и задать `baseUrl`, `apiKey`.

## API ПАПА (соответствие GIPS RS)

| Endpoint | GIPS RS | Описание |
|----------|---------|----------|
| POST /api/signature/idemia/create | POST /gips/v1/identities | Создать сессию верификации |
| POST /api/signature/idemia/consent | POST /gips/v1/identities/{id}/consents | Согласие на обработку биометрии |
| POST /api/signature/idemia/capture-document | POST /gips/v1/identities/{id}/id-documents/capture | Загрузить документ |
| GET /api/signature/idemia/status?identityId=... | GET /gips/v1/identities/{id}/status | Статус identity и LOA |
| POST /api/signature/idemia/verify-portrait | POST /gips/v1/identities/{id}/attributes/portrait/capture | Загрузить селфи |
| GET /api/signature/idemia/healthcheck | GET /gips/healthcheck | Проверка доступности IDEMIA |
| DELETE /api/signature/idemia/delete | DELETE /gips/v1/identities/{id} | Удалить identity |

### Flow верификации

1. **Create** — клиент вызывает `POST /api/signature/idemia/create` → получает `identityId`
2. **Consent** — `POST /api/signature/idemia/consent` с `{ identityId }`
3. **Document** — загрузка документа (front/back) через IDEMIA Capture SDK или сторонний UI (требуется отдельная реализация)
4. **Poll document** — ждать статус `VERIFIED`
5. **Portrait** — `POST /api/signature/idemia/verify-portrait` (multipart: identityId, Portrait)
6. **Sign** — при `verified: true` продолжить подписание документа

## Библиотека

`lib/idemia-client.ts` — клиент для GIPS Relying Service API:

| Функция | GIPS RS Endpoint |
|---------|------------------|
| `createIdentity()` | POST /gips/v1/identities |
| `submitConsent()` | POST /gips/v1/identities/{id}/consents |
| `captureIdDocument()` | POST /gips/v1/identities/{id}/id-documents/capture |
| `getDocumentStatus()` | GET /gips/v1/identities/{id}/status/{elementId} |
| `capturePortrait()` | POST /gips/v1/identities/{id}/attributes/portrait/capture |
| `getPortraitStatus()` | GET /gips/v1/identities/{id}/status/{elementId} |
| `getIdentity()` | GET /gips/v1/identities/{id} |
| `getIdentityStatus()` | GET /gips/v1/identities/{id}/status |
| `getProof()` | GET /gips/v1/identities/{id}/proof |
| `deleteIdentity()` | DELETE /gips/v1/identities/{id} |
| `submitPortraitReference()` | POST /gips/v1/identities/{id}/portrait-reference |
| `getEvidenceStatus()` | GET /gips/v1/identities/{id}/evidences/{evidenceId}/status |
| `healthcheck()` | GET /gips/healthcheck |

## Сценарии использования

### A. Identity Proofing (KYC)

Полная верификация: документ + селфи. Для онбординга сотрудников или высокой степени уверенности (LOA2+).

### B. Подписание после верификации

После успешной верификации лица (Step 6) — вызов `signDocumentAfterBiometricVerify(documentHash)` аналогично WebAuthn flow.

### C. Повторная верификация (1:1)

Для повторных подписей: сравнение селфи с эталонным фото (требует хранения reference или вызов IDEMIA Biometric Services 1:1 API — отдельный продукт).

## Требования

- API key от IDEMIA (контракт с IDEMIA)
- HTTPS
- Согласие пользователя на обработку биометрических данных (GDPR, локальное законодательство)

## См. также

- `docs/ops/ECP_BIOMETRIC.md` — WebAuthn (отпечаток)
- `docs/ops/ECP_JURIDICAL_VERIFICATION.md` — юридическая проверка ЭЦП
