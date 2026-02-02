# Inspection Card Transitions (v0.1.10)

State machine для техкарт контроля. Permission: `INSPECTION.MANAGE`.

## Valid transitions

| From | To |
|------|-----|
| DRAFT | IN_PROGRESS, CANCELLED |
| IN_PROGRESS | COMPLETED, CANCELLED |
| COMPLETED | — (immutable) |
| CANCELLED | — (terminal) |

## Immutability

- **COMPLETED** — карта не может быть изменена или переведена в другой статус.
- **CANCELLED** — терминальный статус (переходы не поддерживаются).

## API

### POST /api/inspection/cards/:id/transition

**Body:** `{ "status": "IN_PROGRESS" | "COMPLETED" | "CANCELLED" }`

**Response 200:** обновлённая карта с `from_status` в ответе.

**Errors:**
- `400` — invalid status, invalid transition, or card is immutable.

## Audit trail

При успешном переходе в `ledger_events` записывается событие `INSPECTION_CARD_TRANSITION`:

```json
{
  "inspection_card_id": "...",
  "card_no": "IC-001",
  "from_status": "DRAFT",
  "to_status": "IN_PROGRESS",
  "transitioned_by": "user@example.com",
  "transitioned_at": "2026-02-01T12:00:00.000Z"
}
```

## Implementation

- `lib/inspection/transitions.ts` — state machine, `validateTransition`
- `lib/inspection-audit.ts` — `appendInspectionTransitionEvent`
- `app/api/inspection/cards/[id]/transition/route.ts` — API handler
