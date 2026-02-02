# RBAC

## Permission taxonomy

### TMC

- `TMC.REQUEST.VIEW` — read-only доступ к TMC requests, items, lots (list/get/export read-only)
- `TMC.REQUEST.MANAGE` — операции с изменениями (create/update/delete/status transitions)

Legacy aliases (backward compatible):

- `TMC.VIEW` ⇒ `TMC.REQUEST.VIEW`
- `TMC.MANAGE` ⇒ `TMC.REQUEST.MANAGE`

### Inspection

- `INSPECTION.VIEW` — read-only доступ к техкартам контроля (list/detail)
- `INSPECTION.MANAGE` — создание/заполнение техкарт (implies VIEW)

### System

- `WORKSPACE.READ`
- `LEDGER.READ`

## Endpoint → Permission mapping

> Rule of thumb:
>
> - GET/read endpoints require `*.VIEW`
> - mutating endpoints require `*.MANAGE`
> - `*.MANAGE` implies `*.VIEW`

| Area | Endpoint | Method | Required permission(s) | Notes |
|------|----------|--------|------------------------|-------|
| Verify | `/api/system/verify` | GET | `WORKSPACE.READ` | Ledger included only if `LEDGER.READ` else `skipped` |
| TMC | `/api/tmc/items` | GET | `TMC.REQUEST.VIEW` (or legacy `TMC.VIEW`) | read-only |
| TMC | `/api/tmc/lots` | GET | `TMC.REQUEST.VIEW` (or legacy `TMC.VIEW`) | read-only |
| TMC | `/api/tmc/requests` | GET | `TMC.REQUEST.VIEW` (or legacy `TMC.VIEW`) | list |
| TMC | `/api/tmc/requests/:id` | GET | `TMC.REQUEST.VIEW` (or legacy `TMC.VIEW`) | detail *(future)* |
| TMC | `/api/tmc/requests` | POST | `TMC.REQUEST.MANAGE` (or legacy `TMC.MANAGE`) | create *(future)* |
| TMC | `/api/tmc/requests/:id` | PATCH | `TMC.REQUEST.MANAGE` (or legacy `TMC.MANAGE`) | update *(future)* |
| TMC | `/api/tmc/requests/:id` | DELETE | `TMC.REQUEST.MANAGE` (or legacy `TMC.MANAGE`) | delete *(future)* |
| TMC | `/api/tmc/requests/:id/transition` | POST | `TMC.REQUEST.MANAGE` (or legacy `TMC.MANAGE`) | status change *(future)* |
| Inspection | `/api/inspection/cards` | GET | `INSPECTION.VIEW` | list |
| Inspection | `/api/inspection/cards/:id` | GET | `INSPECTION.VIEW` | detail |
| Inspection | `/api/inspection/cards/:id/transition` | POST | `INSPECTION.MANAGE` | status change |

## Deprecation plan (legacy permissions)

- `TMC.VIEW` and `TMC.MANAGE` are supported as aliases.
- They will be deprecated after Inspection module is introduced and role policies are migrated.

## Implementation

- `lib/authz/rbac-aliases.ts` — alias definitions, `hasPermissionWithAlias()`
- `lib/authz.ts` — `canWithAlias()`, `requirePermissionWithAlias()`
- TMC read endpoints use `requirePermissionWithAlias(TMC.REQUEST.VIEW)` — legacy `TMC.VIEW` satisfies via alias
- All `401`/`403` responses use standard payload `{ error: { code, message, request_id } }` via `lib/api/error-response.ts`; `requirePermission`/`requirePermissionWithAlias` return this format when passing `request` for `x-request-id` correlation
