# Inspection API (v0.1.10)

Read-only API для техкарт контроля. Permission: `INSPECTION.VIEW` (или `INSPECTION.MANAGE`).
Write API (transitions): `INSPECTION.MANAGE`.

## Endpoints

### GET /api/inspection/cards

Список техкарт с пагинацией.

**Query params:**
- `kind` — `INPUT` | `OUTPUT` (опционально)
- `status` — `DRAFT` | `IN_PROGRESS` | `COMPLETED` | `CANCELLED` (опционально)
- `limit`, `offset` — пагинация (см. `lib/pagination.ts`)

**Response:**
```json
{
  "cards": [
    {
      "inspection_card_id": "...",
      "tmc_request_id": "...",
      "card_kind": "INPUT",
      "card_no": "IC-001",
      "status": "DRAFT",
      "request_no": "SEED-001",
      "request_kind": "INCOMING",
      "request_title": "...",
      ...
    }
  ],
  "hasMore": false
}
```

### GET /api/inspection/cards/:id

Деталь техкарты с результатами проверок.

**Response:**
```json
{
  "inspection_card_id": "...",
  "tmc_request_id": "...",
  "card_kind": "INPUT",
  "card_no": "IC-001",
  "status": "DRAFT",
  "request_no": "...",
  "request_title": "...",
  "check_results": [
    {
      "inspection_check_result_id": "...",
      "check_code": "DOCS",
      "result": "PASS",
      "comment": null,
      ...
    }
  ]
}
```

### POST /api/inspection/cards/:id/transition

Изменение статуса техкарты. Permission: `INSPECTION.MANAGE`.

**Body:** `{ "status": "IN_PROGRESS" | "COMPLETED" | "CANCELLED" }`

**Response 200:** обновлённая карта с `from_status` в ответе.

**Errors:** `400` — invalid status, invalid transition, or card is immutable. См. [INSPECTION_TRANSITIONS.md](INSPECTION_TRANSITIONS.md).

### POST /api/inspection/cards/:id/check-results

Запись результатов проверок. Permission: `INSPECTION.MANAGE`.

**Body:**
```json
{
  "results": [
    { "check_code": "DOCS", "result": "PASS", "value": "12.3", "unit": "kg", "comment": "" },
    { "check_code": "QTY", "result": "FAIL", "comment": "Несоответствие" }
  ]
}
```

- `check_code` — код из шаблона для `card_kind` карты (DOCS, PACK, QTY, VIS для INPUT; QTY, MARK, PACK для OUTPUT).
- `result` — `PASS` | `FAIL` | `NA`.
- `value` — опционально, строковое значение (например вес, количество).
- `unit` — опционально, единица измерения (kg, pcs и т.д.).
- `comment` — опционально.

**Response 200:** `{ card, check_results, changed }`

**Errors:**
- `400` — card COMPLETED/CANCELLED (immutable), invalid check_code, invalid payload.
- `403` — нет INSPECTION.MANAGE.

## Roles

| Role | INSPECTION.VIEW | INSPECTION.MANAGE |
|------|-----------------|-------------------|
| ADMIN | ✓ | ✓ |
| MANAGER | ✓ | ✓ |
| STOREKEEPER | ✓ | ✓ |
| ENGINEER | ✓ | — |
| AUDITOR | ✓ | — |
