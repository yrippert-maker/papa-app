# Governance Model

## Overview

Key lifecycle operations (rotate, revoke) require **2-man rule** approval to eliminate single-actor risk.

---

## 1. Approval Flow

### Roles

| Role | Permission | Can Initiate | Can Approve |
|------|------------|--------------|-------------|
| Initiator | `COMPLIANCE.MANAGE` | Yes | No (own request) |
| Approver | `COMPLIANCE.MANAGE` | Yes | Yes (others') |
| Admin | `ADMIN.MANAGE_USERS` | Yes | Yes |

### Constraints

- **Initiator ≠ Approver** (enforced by system)
- Both must have `COMPLIANCE.MANAGE` permission
- All actions logged to immutable ledger

### State Machine

```
[*] --> PENDING: initiate
PENDING --> APPROVED: approve (different user)
PENDING --> REJECTED: reject
PENDING --> EXPIRED: timeout (24h)
APPROVED --> EXECUTED: execute
APPROVED --> EXPIRED: timeout (1h)
REJECTED --> [*]
EXPIRED --> [*]
EXECUTED --> [*]
```

---

## 2. Timeouts

| Phase | Timeout | Description |
|-------|---------|-------------|
| Approval | 24 hours | Request expires if not approved |
| Execution | 1 hour | Approved request expires if not executed |

---

## 3. API Endpoints

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/compliance/keys/requests` | `COMPLIANCE.VIEW` | List requests |
| POST | `/api/compliance/keys/requests` | `COMPLIANCE.MANAGE` | Create request |
| POST | `/api/compliance/keys/requests/:id/approve` | `COMPLIANCE.MANAGE` | Approve (2nd user) |
| POST | `/api/compliance/keys/requests/:id/reject` | `COMPLIANCE.MANAGE` | Reject |
| POST | `/api/compliance/keys/requests/:id/execute` | `COMPLIANCE.MANAGE` | Execute approved |

---

## 4. Ledger Events

All governance actions are logged to the immutable ledger:

| Event Type | Description |
|------------|-------------|
| `KEY_REQUEST_CREATED` | New request initiated |
| `KEY_REQUEST_APPROVED` | Request approved by 2nd user |
| `KEY_REQUEST_REJECTED` | Request rejected |
| `KEY_REQUEST_EXECUTED` | Approved request executed |

---

## 5. Signed Artifacts

### Intent (Initiator signs)

```json
{
  "request_id": "uuid",
  "action": "ROTATE",
  "target_key_id": null,
  "reason": "Scheduled rotation",
  "initiator_id": "user-123",
  "created_at": "2026-02-02T...",
  "expires_at": "2026-02-03T..."
}
```

### Approval (Approver signs)

```json
{
  "request_id": "uuid",
  "action": "APPROVE",
  "approver_id": "user-456",
  "approved_at": "2026-02-02T..."
}
```

---

## 6. UI

**Location:** `/compliance/requests`

### Features

- View all requests (pending, approved, executed, etc.)
- Create new request (ROTATE or REVOKE)
- Approve/reject pending requests (2-man rule enforced)
- Execute approved requests
- Auto-refresh expired status

---

## 7. Compliance Mapping

| Standard | Control | Implementation |
|----------|---------|----------------|
| SOC 2 | CC6.1 | 2-man rule for key ops |
| ISO 27001 | A.9.2.3 | Privileged access management |
| PCI DSS | 3.6.4 | Key management procedures |

---

## 8. Cron Jobs

### Expire Timed-Out Requests

Requests are automatically expired on API access, but a cron job can ensure timely cleanup:

```bash
# /etc/cron.hourly/papa-expire-requests
curl -X GET "http://localhost:3000/api/compliance/keys/requests" \
  -H "Authorization: Bearer $SYSTEM_TOKEN"
```

---

## See Also

- [RETENTION_POLICY.md](./RETENTION_POLICY.md)
- [EVIDENCE_SIGNING.md](./EVIDENCE_SIGNING.md)
- [ALERTS_COMPLIANCE.md](./ALERTS_COMPLIANCE.md)
