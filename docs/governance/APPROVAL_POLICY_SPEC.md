# Approval Policy Specification

**Document ID:** GOV-POLICY-001  
**Version:** 1.0.0  
**Effective Date:** 2026-02-02  
**Schema Version:** 1.0.0

---

## 1. Overview

This document provides the formal specification for approval policies governing key lifecycle operations. All policies are machine-readable and version-controlled.

---

## 2. Policy Schema

### 2.1 JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://papa-app.io/schemas/approval-policy-v1.json",
  "title": "Approval Policy",
  "type": "object",
  "required": [
    "policy_id",
    "version",
    "key_class",
    "approval_requirements",
    "timeouts",
    "constraints"
  ],
  "properties": {
    "policy_id": {
      "type": "string",
      "pattern": "^POL-[A-Z0-9]{8}$"
    },
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$"
    },
    "name": {
      "type": "string",
      "maxLength": 100
    },
    "description": {
      "type": "string",
      "maxLength": 500
    },
    "key_class": {
      "type": "string",
      "enum": ["standard", "critical", "root"]
    },
    "approval_requirements": {
      "type": "object",
      "required": ["min_approvers", "quorum_type"],
      "properties": {
        "min_approvers": {
          "type": "integer",
          "minimum": 2,
          "maximum": 10
        },
        "total_pool": {
          "type": "integer",
          "minimum": 0,
          "description": "0 = any eligible approver"
        },
        "quorum_type": {
          "type": "string",
          "enum": ["n_of_any", "n_of_m", "unanimous"]
        }
      }
    },
    "timeouts": {
      "type": "object",
      "required": ["approval_hours", "execution_hours"],
      "properties": {
        "approval_hours": {
          "type": "integer",
          "minimum": 1,
          "maximum": 168
        },
        "execution_hours": {
          "type": "integer",
          "minimum": 1,
          "maximum": 24
        }
      }
    },
    "constraints": {
      "type": "object",
      "properties": {
        "require_different_teams": {
          "type": "boolean"
        },
        "require_different_orgs": {
          "type": "boolean"
        },
        "require_senior_approver": {
          "type": "boolean"
        },
        "blocked_hours": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "day": { "type": "string" },
              "start_hour": { "type": "integer" },
              "end_hour": { "type": "integer" }
            }
          }
        }
      }
    },
    "scope": {
      "type": "object",
      "properties": {
        "org_id": { "type": ["string", "null"] },
        "team_id": { "type": ["string", "null"] }
      }
    },
    "metadata": {
      "type": "object",
      "properties": {
        "created_at": { "type": "string", "format": "date-time" },
        "created_by": { "type": "string" },
        "approved_at": { "type": "string", "format": "date-time" },
        "approved_by": { "type": "string" },
        "effective_date": { "type": "string", "format": "date" },
        "review_date": { "type": "string", "format": "date" }
      }
    }
  }
}
```

---

## 3. Default Policies

### 3.1 Standard Key Policy

```json
{
  "policy_id": "POL-STANDARD",
  "version": "1.0.0",
  "name": "Standard Key Operations",
  "description": "Default policy for standard key class operations",
  "key_class": "standard",
  "approval_requirements": {
    "min_approvers": 2,
    "total_pool": 0,
    "quorum_type": "n_of_any"
  },
  "timeouts": {
    "approval_hours": 24,
    "execution_hours": 1
  },
  "constraints": {
    "require_different_teams": false,
    "require_different_orgs": false,
    "require_senior_approver": false,
    "blocked_hours": []
  },
  "scope": {
    "org_id": null,
    "team_id": null
  },
  "metadata": {
    "created_at": "2026-02-02T00:00:00Z",
    "created_by": "system",
    "approved_at": "2026-02-02T00:00:00Z",
    "approved_by": "security_council",
    "effective_date": "2026-02-02",
    "review_date": "2026-08-02"
  }
}
```

### 3.2 Critical Key Policy

```json
{
  "policy_id": "POL-CRITICAL",
  "version": "1.0.0",
  "name": "Critical Key Operations",
  "description": "Policy for critical key class with enhanced controls",
  "key_class": "critical",
  "approval_requirements": {
    "min_approvers": 3,
    "total_pool": 0,
    "quorum_type": "n_of_any"
  },
  "timeouts": {
    "approval_hours": 48,
    "execution_hours": 2
  },
  "constraints": {
    "require_different_teams": true,
    "require_different_orgs": false,
    "require_senior_approver": true,
    "blocked_hours": [
      { "day": "Saturday", "start_hour": 0, "end_hour": 24 },
      { "day": "Sunday", "start_hour": 0, "end_hour": 24 }
    ]
  },
  "scope": {
    "org_id": null,
    "team_id": null
  },
  "metadata": {
    "created_at": "2026-02-02T00:00:00Z",
    "created_by": "system",
    "approved_at": "2026-02-02T00:00:00Z",
    "approved_by": "security_council",
    "effective_date": "2026-02-02",
    "review_date": "2026-08-02"
  }
}
```

### 3.3 Root Key Policy

```json
{
  "policy_id": "POL-ROOT",
  "version": "1.0.0",
  "name": "Root Key Operations",
  "description": "Maximum security policy for root key operations",
  "key_class": "root",
  "approval_requirements": {
    "min_approvers": 4,
    "total_pool": 5,
    "quorum_type": "n_of_m"
  },
  "timeouts": {
    "approval_hours": 72,
    "execution_hours": 4
  },
  "constraints": {
    "require_different_teams": true,
    "require_different_orgs": true,
    "require_senior_approver": true,
    "blocked_hours": [
      { "day": "Saturday", "start_hour": 0, "end_hour": 24 },
      { "day": "Sunday", "start_hour": 0, "end_hour": 24 },
      { "day": "*", "start_hour": 22, "end_hour": 6 }
    ]
  },
  "scope": {
    "org_id": null,
    "team_id": null
  },
  "metadata": {
    "created_at": "2026-02-02T00:00:00Z",
    "created_by": "system",
    "approved_at": "2026-02-02T00:00:00Z",
    "approved_by": "security_council",
    "effective_date": "2026-02-02",
    "review_date": "2026-08-02"
  }
}
```

---

## 4. Policy Evaluation Rules

### 4.1 Precedence

1. Team-specific policy (most specific)
2. Org-specific policy
3. Key-class default policy (least specific)

### 4.2 Constraint Evaluation

```
ALLOW if:
  current_approvals >= min_approvers
  AND (total_pool == 0 OR approvers ⊆ designated_pool)
  AND (NOT require_different_teams OR unique_teams(approvers) >= min(2, min_approvers))
  AND (NOT require_different_orgs OR unique_orgs(approvers) >= min(2, min_approvers))
  AND (NOT require_senior_approver OR has_senior(approvers))
  AND NOT in_blocked_hours(current_time)
  AND NOT expired(request)
```

### 4.3 Timeout Behavior

| State | Timeout Reached | Action |
|-------|-----------------|--------|
| PENDING | approval_hours | → EXPIRED |
| APPROVED | execution_hours | → EXPIRED |

---

## 5. Policy Versioning

### 5.1 Version Format

`MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes (new required fields, removed fields)
- **MINOR**: Backward-compatible additions
- **PATCH**: Documentation or metadata only

### 5.2 Change Control

| Change Type | Approval Required | Notice Period |
|-------------|-------------------|---------------|
| MAJOR | Security Council | 30 days |
| MINOR | Security Officer | 7 days |
| PATCH | Compliance Officer | None |

### 5.3 Migration

When policy version changes:
1. New policy created with incremented version
2. Old policy marked `deprecated: true`
3. Grace period for in-flight requests
4. Old policy archived after grace period

---

## 6. Policy Hash

Each policy has a deterministic hash for integrity verification:

```
policy_hash = SHA256(canonical_json(policy - metadata))
```

The hash is computed excluding the `metadata` section to allow administrative changes without affecting the policy hash.

---

## 7. Audit Events

### 7.1 Policy Lifecycle Events

| Event Type | Trigger |
|------------|---------|
| `POLICY_CREATED` | New policy created |
| `POLICY_UPDATED` | Policy modified |
| `POLICY_DEPRECATED` | Policy marked deprecated |
| `POLICY_ARCHIVED` | Policy removed from active use |

### 7.2 Event Payload

```json
{
  "event_type": "POLICY_UPDATED",
  "policy_id": "POL-STANDARD",
  "old_version": "1.0.0",
  "new_version": "1.1.0",
  "changed_by": "user-123",
  "changed_at": "2026-02-02T12:00:00Z",
  "changes": {
    "approval_requirements.min_approvers": { "old": 2, "new": 3 }
  }
}
```

---

## 8. Compliance Mapping

| Policy Requirement | SOC 2 | ISO 27001 | PCI DSS |
|-------------------|-------|-----------|---------|
| 2-man rule | CC6.1 | A.9.2.3 | 3.6.4 |
| Timeout enforcement | CC6.6 | A.9.4.1 | 8.1.8 |
| Audit logging | CC7.2 | A.12.4.1 | 10.2.1 |
| Version control | CC8.1 | A.12.1.2 | 6.4.3 |

---

## 9. Implementation Reference

### 9.1 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/compliance/policies` | List all policies |
| GET | `/api/compliance/policies?key_class=X` | Get effective policy |
| POST | `/api/compliance/policies` | Create/update policy |

### 9.2 Validation

```typescript
import Ajv from 'ajv';
import schema from './approval-policy-schema.json';

const ajv = new Ajv();
const validate = ajv.compile(schema);

function validatePolicy(policy: unknown): boolean {
  return validate(policy);
}
```

---

## 10. Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-02 | Security Team | Initial release |
