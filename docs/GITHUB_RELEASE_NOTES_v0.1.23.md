# Release v0.1.23 — Audit Filters & Pagination

## Overview
v0.1.23 добавляет фильтры (date range, action type) и cursor-based пагинацию для audit log ключей.

---

## Key Changes

### Audit Filters

| Filter | Type | Example |
|--------|------|---------|
| `from` | ISO date | `2026-01-01` |
| `to` | ISO date | `2026-01-31` |
| `action` | enum | `KEY_ROTATED` \| `KEY_REVOKED` |

### Cursor Pagination

```
GET /api/compliance/keys/audit?limit=20&cursor=123
```

Response:
```json
{
  "events": [...],
  "total": 150,
  "next_cursor": 103,
  "has_more": true
}
```

### API Updates

| Endpoint | Changes |
|----------|---------|
| `/api/compliance/keys/audit` | +from, +to, +action, +cursor params |
| `/api/compliance/export?type=key-audit` | +from, +to, +action params |

### UI Updates (`/compliance/keys`)

- Date range pickers (from/to)
- Action type dropdown filter
- Reset filters button
- "Load more" pagination button
- Total count display

### Service Layer

- `KeyAuditFilter` type with from/to/action/limit/cursor
- `KeyAuditResponse` type with events/total/next_cursor/has_more
- Dynamic SQL query builder with filters

---

## Tests
- Total: **215 tests passed**
- Build: OK
- E2E: all passed

---

## Release Artifacts
- `dist/regulatory-bundle-v0.1.23.zip`
- SHA-256: **<ADD_SHA256_HERE>**
