# Release v0.1.12 — Inspection check_results write-path + ledger audit

## Overview
v0.1.12 добавляет write-path для результатов проверок по техкартам (Inspection):
запись/обновление `check_results` под `INSPECTION.MANAGE` с idempotency без дублей
и audit trail в ledger при каждом реальном изменении.

---

## Key Changes

### API: write check results
- `POST /api/inspection/cards/:id/check-results`
  - Body:
    ```json
    {
      "results": [
        { "check_code": "DOCS", "result": "PASS", "value": "10", "unit": "pcs", "comment": "ok" }
      ]
    }
    ```
  - `value` / `unit` — optional strings
  - Response: `{ card, check_results, changed }`
- Validation:
  - `check_code` валидируется по шаблонам для `card_kind`
- Immutability:
  - запись разрешена только в `DRAFT | IN_PROGRESS`
  - `COMPLETED | CANCELLED` → `400 BAD_REQUEST`
- RBAC:
  - только `INSPECTION.MANAGE`

### Storage / Idempotency
- Upsert по `(inspection_card_id, check_code)`
- Повторный запрос без изменений:
  - `changed=false`
  - ledger event не создаётся

### Ledger audit
- Новый тип события: `INSPECTION_CHECK_RECORDED`
- Создаётся только при `changed=true`
- Payload включает: `check_code`, `result`, `value`, `unit`, `comment`

### Database
- Миграция: `inspection_check_result` расширена колонками `value`, `unit`

### Documentation
- `docs/INSPECTION_API.md` — обновлён контракт (value/unit)

---

## Tests
- Unit: ledger schema + payload (value/unit)
- Integration: запись check results с value/unit, immutability, RBAC
- E2E: smoke пройден
- Total: **161 tests passed**
- Build: ✅

---

## Release Artifacts
- `dist/regulatory-bundle-v0.1.12.zip`
- SHA-256: **15ed5c678b42fe79652a8e67f9c117fe4f6b729c1133808fe0fee886f04e7f30**
