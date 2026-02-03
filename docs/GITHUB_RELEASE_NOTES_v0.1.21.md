# Release v0.1.21 — Compliance UI Dashboard

## Overview
v0.1.21 добавляет Compliance Dashboard — UI для мониторинга и управления ключами подписи Evidence, просмотра статистики верификации и dead-letter метрик.

---

## Key Changes

### New Permissions
- `COMPLIANCE.VIEW` — просмотр ключей и статистики
- `COMPLIANCE.MANAGE` — ротация и отзыв ключей

### New API Endpoints

| Endpoint | Method | Permission | Description |
|----------|--------|------------|-------------|
| `/api/compliance/keys` | GET | COMPLIANCE.VIEW | Список ключей с статусами |
| `/api/compliance/keys/rotate` | POST | COMPLIANCE.MANAGE | Ротация ключа |
| `/api/compliance/keys/:keyId/revoke` | POST | COMPLIANCE.MANAGE | Отзыв ключа |
| `/api/compliance/verify-stats` | GET | COMPLIANCE.VIEW | Статистика верификации |

### New UI Pages

#### Keys Status (`/compliance/keys`)
- Просмотр активного ключа
- Таблица архивных/отозванных ключей
- Действия: Rotate (для active), Revoke (для archived)
- Confirmation dialogs для destructive actions

#### Verify Statistics (`/compliance/verify`)
- Summary cards: Total / OK / Errors / Rate Limited
- Error breakdown: KEY_REVOKED, KEY_NOT_FOUND, SIGNATURE_INVALID, etc.
- Dead-letter status: events, replay stats

### Navigation
- Новая секция "Compliance" в sidebar:
  - Ключи → /compliance/keys
  - Статистика → /compliance/verify
  - Проверить → /inspection/verify

### Service Layer
- `lib/compliance-service.ts` — бизнес-логика compliance UI

### AuthZ Updates
- 4 новых маршрута в route registry
- 2 новых permission в VALID_PERMISSIONS

---

## Tests
- Unit: compliance-service
- AuthZ: route registry coverage
- Total: **215 tests passed**
- Build: ✅
- E2E: all passed

---

## Release Artifacts
- `dist/regulatory-bundle-v0.1.21.zip`
- SHA-256: **7f075cfde02b43076941de1f4cb9cf41962a383221858f7523acea73160fed26**
