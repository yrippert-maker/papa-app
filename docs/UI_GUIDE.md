# UI Guide — v0.1.4

## Status badges semantics

Status badges appear in the sidebar (when expanded) and provide quick access to system verification.

| Badge | Meaning | Click action |
|-------|---------|--------------|
| **Workspace** | Workspace exists (OK) / not found (—) | → `/workspace` |
| **Ledger** | Ledger Active / Empty / — | → `/system/verify` |
| **AuthZ** | Verify RBAC (visible only with WORKSPACE.READ) | → `/system/verify` |

- Badges are hidden when the sidebar is collapsed.
- Workspace and Ledger badges are always visible (when expanded).
- AuthZ badge is visible only to users with `WORKSPACE.READ` permission.
- All badges are keyboard-accessible (`Link`, `aria-label`).

## Verify pages and permissions

| Page | Permission | Purpose |
|------|------------|---------|
| `/system/verify` | WORKSPACE.READ (page), LEDGER.READ (Ledger section) | AuthZ and Ledger verification; visible to auditor/admin |

- **AuthZ section:** requires WORKSPACE.READ (same as page).
- **Ledger section:** requires LEDGER.READ; users without it see "Требуется право LEDGER.READ".

### API response format `/api/ledger/verify`

- **200 OK:** `{ ok: true, message, scope: { event_count, id_min, id_max }, timing_ms: { total } }`; `Cache-Control: no-store`
- **403:** access denied (LEDGER.READ required)
- **409:** integrity error (chain break, hash mismatch)
- **429:** rate limit (10 req/min); `Retry-After` header
- **500:** internal error

## StatePanel

Shared component for consistent empty/error/warning/loading states.

- **Variants:** `loading`, `empty`, `warning`, `error`, `success`
- **Use:** Workspace init status, AI Inbox upload result, system verify result, access denied
- **No raw JSON/stack traces** in user-facing UI.
