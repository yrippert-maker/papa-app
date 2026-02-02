# Release v0.2.0 — Governance Layer

## Overview

v0.2.0 introduces a complete governance layer for key lifecycle management with 2-man rule approval flow, audit snapshots, and break-glass emergency override.

---

## Key Changes

### 2-Man Rule Approval Flow (v0.2.0)

- **DB schema**: `key_lifecycle_requests` table for request tracking
- **State machine**: PENDING → APPROVED → EXECUTED (or REJECTED/EXPIRED)
- **Constraint**: Initiator ≠ Approver (enforced in code)
- **Timeouts**: 24h for approval, 1h for execution
- **API endpoints**:
  - `POST /api/compliance/keys/requests` — create request
  - `GET /api/compliance/keys/requests` — list requests
  - `POST /api/compliance/keys/requests/:id/approve` — approve (2nd user)
  - `POST /api/compliance/keys/requests/:id/reject` — reject
  - `POST /api/compliance/keys/requests/:id/execute` — execute approved
- **UI**: `/compliance/requests` — manage requests, approve/reject/execute

### Enforcement (v0.2.1)

- Direct `rotate` and `revoke` APIs blocked (return `403 APPROVAL_REQUIRED`)
- Timeout enforcement via `scripts/expire-requests.mjs`
- UI buttons redirect to requests workflow

### Audit Snapshots (v0.2.2)

- **Snapshot service**: `lib/audit-snapshot-service.ts`
- **Snapshot schema**: policy hash, key status, events, hash chain
- **Signing**: Snapshots signed with active Ed25519 key
- **CLI**:
  - `npm run audit:snapshot:daily`
  - `npm run audit:snapshot:weekly`
- **Storage**: `{WORKSPACE}/00_SYSTEM/audit-snapshots/`

### Snapshot Verification (v0.2.3)

- **Verify CLI**: `npm run audit:snapshot:verify`
- **Chain validation**: Verifies `previous_snapshot_hash` continuity
- **API**: `GET /api/compliance/snapshots` — list/read snapshots
- **UI**: `/compliance/snapshots` — dashboard with snapshot history

### Break-Glass Emergency Override (v0.2.4)

- **Activation**: `POST /api/compliance/break-glass { action: "activate", reason: "..." }`
- **Duration**: 4 hours auto-expire
- **Permission**: `ADMIN.MANAGE_USERS` only
- **Bypasses**: 2-man rule for rotate/revoke during break-glass
- **Logging**: All break-glass actions logged to ledger with elevated visibility
- **Events**: `BREAK_GLASS_ACTIVATED`, `BREAK_GLASS_DEACTIVATED`, `BREAK_GLASS_EXPIRED`

---

## New Files

| File | Purpose |
|------|---------|
| `migrations/006_key_lifecycle_requests.up.sql` | DB schema |
| `lib/key-lifecycle-service.ts` | Request lifecycle + break-glass |
| `lib/audit-snapshot-service.ts` | Snapshot generation |
| `app/api/compliance/keys/requests/` | Request API endpoints |
| `app/api/compliance/break-glass/route.ts` | Break-glass API |
| `app/api/compliance/snapshots/route.ts` | Snapshots API |
| `app/compliance/requests/page.tsx` | Requests UI |
| `app/compliance/snapshots/page.tsx` | Snapshots dashboard |
| `scripts/expire-requests.mjs` | Timeout cleanup |
| `scripts/generate-audit-snapshot.mjs` | Snapshot CLI |
| `scripts/verify-audit-snapshots.mjs` | Verify CLI |
| `docs/ops/GOVERNANCE_MODEL.md` | Documentation |

---

## Ledger Events

| Event Type | Description |
|------------|-------------|
| `KEY_REQUEST_CREATED` | New approval request |
| `KEY_REQUEST_APPROVED` | Request approved by 2nd user |
| `KEY_REQUEST_REJECTED` | Request rejected |
| `KEY_REQUEST_EXECUTED` | Approved request executed |
| `BREAK_GLASS_ACTIVATED` | Emergency mode activated |
| `BREAK_GLASS_DEACTIVATED` | Emergency mode deactivated |
| `BREAK_GLASS_EXPIRED` | Emergency mode auto-expired |

---

## Route Count

- Total: **38 routes** (+8 from v0.1.27)
- New compliance routes properly secured with permissions

---

## Tests

- Unit + integration tests pass
- Total: **220 tests passed**
- Build: ✅

---

## Compliance Mapping

| Standard | Control | Implementation |
|----------|---------|----------------|
| SOC 2 | CC6.1 | 2-man rule |
| ISO 27001 | A.9.2.3 | Privileged access management |
| PCI DSS | 3.6.4 | Key management procedures |

---

## Regulatory Bundle

```
Bundle: dist/regulatory-bundle-v0.2.0.zip
SHA-256: <TBD>
```
