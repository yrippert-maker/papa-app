# Inspection API (MVP)

Read-only API для техкарт контроля. Permission: `INSPECTION.VIEW` (или `INSPECTION.MANAGE`).

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

## Roles

| Role | INSPECTION.VIEW |
|------|-----------------|
| ADMIN | ✓ |
| MANAGER | ✓ |
| STOREKEEPER | ✓ |
| ENGINEER | ✓ |
| AUDITOR | ✓ |
