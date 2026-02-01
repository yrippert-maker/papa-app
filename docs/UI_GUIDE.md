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
| `/system/verify` | WORKSPACE.READ | AuthZ and Ledger verification; visible to auditor/admin |

Users without WORKSPACE.READ see "Доступ запрещён" on direct access.

## StatePanel

Shared component for consistent empty/error/warning/loading states.

- **Variants:** `loading`, `empty`, `warning`, `error`, `success`
- **Use:** Workspace init status, AI Inbox upload result, system verify result, access denied
- **No raw JSON/stack traces** in user-facing UI.
