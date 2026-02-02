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

## Roles

| Role | INSPECTION.VIEW | INSPECTION.MANAGE |
|------|-----------------|-------------------|
| ADMIN | ✓ | ✓ |
| MANAGER | ✓ | ✓ |
| STOREKEEPER | ✓ | ✓ |
| ENGINEER | ✓ | — |
| AUDITOR | ✓ | — |
