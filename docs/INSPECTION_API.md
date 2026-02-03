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

### GET /api/inspection/report

Агрегированный отчёт по техкартам. Permission: `INSPECTION.VIEW`.

**Query params:**
- `kind` — `INPUT` | `OUTPUT` (опционально)
- `status` — `DRAFT` | `IN_PROGRESS` | `COMPLETED` | `CANCELLED` (опционально)
- `from_date`, `to_date` — ISO date `YYYY-MM-DD` (опционально, фильтр по `created_at`)

**Response:**
```json
{
  "total_cards": 10,
  "by_status": { "DRAFT": 2, "IN_PROGRESS": 3, "COMPLETED": 4, "CANCELLED": 1 },
  "completion_rate_pct": 57,
  "fail_rate_pct": 5,
  "breakdown_by_check_code": {
    "DOCS": { "PASS": 8, "FAIL": 1, "NA": 0 },
    "QTY": { "PASS": 6, "FAIL": 0, "NA": 2 }
  },
  "filters": { "kind": null, "status": null, "from_date": null, "to_date": null }
}
```

- `completion_rate_pct` — процент завершённых среди активных (без CANCELLED).
- `fail_rate_pct` — процент FAIL среди всех результатов проверок.
- `breakdown_by_check_code` — разбивка по коду проверки и результату (PASS/FAIL/NA).

### GET /api/inspection/cards/:id

Деталь техкарты с результатами проверок и подсказками из шаблона.

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
      "value": null,
      "unit": null,
      "comment": null,
      ...
    }
  ],
  "template_hints": {
    "DOCS": { "title": "Проверка документов", "description": "Сопроводительные документы...", "mandatory": true },
    "QTY": { "title": "Проверка количества", "description": "...", "mandatory": true }
  }
}
```

- `template_hints` — подсказки по кодам проверок из шаблона для `card_kind` (для UI: заголовок, описание, обязательность).

### GET /api/inspection/cards/:id/audit

История событий журнала по техкарте (INSPECTION_CARD_TRANSITION, INSPECTION_CHECK_RECORDED). Permission: `INSPECTION.VIEW`.

**Query params:**
- `limit` — макс. событий (default 100, max 500)
- `offset` — смещение для пагинации (default 0)

**Response:**
```json
{
  "events": [
    {
      "id": 1,
      "event_type": "INSPECTION_CARD_TRANSITION",
      "payload": {
        "inspection_card_id": "...",
        "from_status": "DRAFT",
        "to_status": "IN_PROGRESS",
        "transitioned_by": "admin@local",
        "transitioned_at": "2025-01-15T10:00:00.000Z"
      },
      "created_at": "2025-01-15T10:00:00.000Z",
      "block_hash": "...",
      "actor_id": "..."
    },
    {
      "id": 2,
      "event_type": "INSPECTION_CHECK_RECORDED",
      "payload": {
        "inspection_card_id": "...",
        "check_code": "DOCS",
        "result": "PASS",
        "recorded_by": "admin@local",
        "recorded_at": "2025-01-15T10:05:00.000Z"
      },
      "created_at": "2025-01-15T10:05:00.000Z",
      "block_hash": "...",
      "actor_id": "..."
    }
  ],
  "total": 2,
  "hasMore": false,
  "limit": 100,
  "offset": 0
}
```

**Errors:** `404` — карта не найдена.

### GET /api/inspection/cards/:id/evidence

Evidence export для compliance: snapshot карты + check_results + audit events + export_hash. Permission: `INSPECTION.VIEW`.

**Query params:**
- `signed=1` — добавить Ed25519 подпись `export_hash` (ключи в `{WORKSPACE_ROOT}/00_SYSTEM/keys/`)
- `format=bundle` — вернуть ZIP с `export.json`, `export.signature`, `manifest.json`, `public.pem`

**Response (JSON, default):**
```json
{
  "schema_version": "1",
  "exported_at": "2026-02-02T12:00:00.000Z",
  "inspection_card_id": "CARD-001",
  "card": { "inspection_card_id": "...", "status": "...", ... },
  "check_results": [ { "check_code": "DOCS", "result": "PASS", ... } ],
  "audit_events": [
    {
      "id": 1,
      "event_type": "INSPECTION_CARD_TRANSITION",
      "payload": { ... },
      "created_at": "...",
      "block_hash": "...",
      "prev_hash": null,
      "actor_id": "..."
    }
  ],
  "export_hash": "sha256 hex (64 chars)"
}
```

- `export_hash` — SHA-256 canonical JSON всего экспорта (детерминирован для верификации целостности).
- При `signed=1`:
  - `export_signature` — hex подпись `export_hash` (Ed25519)
  - `export_key_id` — идентификатор ключа (16 hex chars, SHA-256 fingerprint публичного ключа)
  - `export_public_key` — PEM публичный ключ

---

## POST /api/inspection/evidence/verify

Верификация evidence export: проверяет content hash и подпись.

**Permission:** `INSPECTION.VIEW`

**Request body:**
```json
{
  "export_json": { ... },        // полный объект evidence export
  "signature": "hex...",         // опционально, если нет в export_json
  "key_id": "abc123..."          // опционально, если нет в export_json
}
```

**Response:**
```json
{
  "ok": true,
  "content": {
    "valid": true,
    "export_hash": "...",
    "computed_hash": "..."
  },
  "signature": {
    "valid": true,
    "key_id": "abc123...",
    "key_status": {
      "is_active": false,
      "is_revoked": false
    }
  }
}
```

**Ошибки верификации:**
- `ok: false` при несовпадении content hash или невалидной подписи
- `signature.error`: `KEY_NOT_FOUND`, `KEY_REVOKED`, `SIGNATURE_INVALID`, `INVALID_FORMAT`
- `signature.revocation_reason`: причина отзыва ключа (если `KEY_REVOKED`)
- `errors[]`: человекочитаемые описания ошибок

**Response (ZIP, format=bundle):** архив содержит:
- `export.json` — полный evidence export (включая `export_key_id`)
- `export.signature` — hex подпись `export_hash` (Ed25519)
- `manifest.json` — `{ export_key_id, files: { "export.json": { sha256 }, "export.signature": { sha256 } } }`
- `public.pem` — публичный ключ для верификации

**Errors:** `404` — карта не найдена.

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
