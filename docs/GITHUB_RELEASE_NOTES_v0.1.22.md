# Release v0.1.22 — Key Audit Log & CSV Export

## Overview
v0.1.22 добавляет audit log для операций с ключами (rotate/revoke) и CSV экспорт статистики для внешних отчётов.

---

## Key Changes

### Key Audit Log (Ledger-based)
- Все операции rotate/revoke записываются в ledger
- Event types: `COMPLIANCE_KEY_ROTATED`, `COMPLIANCE_KEY_REVOKED`
- Payload: `key_id`, `new_key_id`, `reason`, `actor_id`
- UI: таблица журнала действий на `/compliance/keys`

### New API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/compliance/keys/audit` | GET | Audit log для key actions |
| `/api/compliance/export` | GET | CSV export (type=verify-stats\|key-audit) |

### CSV Export
- Verify Stats: metrics, errors breakdown, dead-letter stats
- Key Audit: timestamp, action, key_id, reason, actor
- Download buttons на UI страницах

### Service Layer
- `logKeyAction()` — запись в ledger
- `getKeyAuditEvents()` — чтение из ledger
- `getVerifyStatsCSV()` — генерация CSV
- `getKeyAuditCSV()` — генерация CSV

### AuthZ Updates
- 2 новых маршрута в route registry (29 total)

---

## UI Updates

### /compliance/keys
- Журнал действий с key_id, action, actor, timestamp
- Кнопка CSV export

### /compliance/verify
- Кнопка CSV export для статистики

---

## Tests
- Total: **215 tests passed**
- Build: OK
- E2E: all passed

---

## Release Artifacts
- `dist/regulatory-bundle-v0.1.22.zip`
- SHA-256: **c17fa6bdf87cf9849ac473907b1cd4221ca73b772a1794b0c95074718bd03bbd**
