# AUTHZ Model (RBAC + Permissions) — v0.1.2

## 1. Purpose

This document defines the normative authorization (AuthZ) model for the system.
Authorization MUST be enforced server-side for every API endpoint using permissions.
Roles MUST NOT be checked directly by endpoints; endpoints MUST check permissions.
Role → permission assignment MUST implement least privilege.

## 2. Non-autonomy constraint

The system MUST preserve non-autonomy constraints:
- AI components are advisory only and MUST NOT execute operational decisions.
- Any DB write path MUST be reachable only via human-authorized routes.
AuthZ MUST NOT introduce any mechanism that enables autonomous execution.

## 3. Concepts

### 3.1 Roles

Roles represent human or system actors. Roles are assigned to authenticated principals.

**Normative roles (current implementation):**
- **ADMIN** — administrative operations and system maintenance tasks.
- **AUDITOR** — read-only access for compliance/audit verification.
- **MANAGER** — operational user with ledger append and workspace access.
- **STOREKEEPER** — warehouse operations (TMC, files).
- **ENGINEER** — engineering access (TMC read, files list).

**Normative roles (model, future):**
- **OPERATOR** — operational user with limited administrative scope (non-certifying).
- **CERTIFYING_ENGINEER** — certifying authority for maintenance decisions (HITL).
- **SYSTEM** — non-human service accounts; MUST be least-privilege and non-interactive.

### 3.2 Permissions

Permissions are atomic capabilities stored in `rbac_permission`.
Endpoints MUST require exactly one primary permission and MUST deny access otherwise.

**Current permissions:**

| Permission | Description |
|------------|-------------|
| WORKSPACE.READ | Workspace status, file list |
| FILES.LIST | List workspace files |
| FILES.UPLOAD | Upload files |
| LEDGER.READ | Read ledger events |
| LEDGER.APPEND | Append to ledger |
| ADMIN.MANAGE_USERS | Create, update users; manage roles |
| TMC.MANAGE | TMC items, lots |
| TMC.REQUEST.VIEW | TMC requests |

### 3.3 Enforcement

- Every endpoint MUST declare required permission(s).
- Authorization MUST be evaluated after authentication and before any business logic execution.
- Deny-by-default: if an endpoint lacks a permission declaration, it MUST fail closed.
- Errors:
  - **401 Unauthorized** — not authenticated
  - **403 Forbidden** — authenticated but lacks permission
  - **409 Conflict** — integrity check failed (e.g. ledger verification)

## 4. Role → permission assignment (normative)

Source of truth: `rbac_role_permission` table, seeded by migrations.
Below is the documented mapping (must match DB).

### 4.1 ADMIN

- WORKSPACE.READ
- FILES.LIST
- FILES.UPLOAD
- LEDGER.READ
- LEDGER.APPEND
- ADMIN.MANAGE_USERS
- TMC.MANAGE, TMC.REQUEST.VIEW (implied by implementation)

### 4.2 AUDITOR

- WORKSPACE.READ
- FILES.LIST
- LEDGER.READ
- (no write permissions)

### 4.3 MANAGER

- WORKSPACE.READ
- FILES.LIST
- FILES.UPLOAD
- LEDGER.READ
- LEDGER.APPEND

### 4.4 STOREKEEPER

- WORKSPACE.READ
- FILES.LIST
- FILES.UPLOAD
- LEDGER.READ

### 4.5 ENGINEER

- WORKSPACE.READ
- FILES.LIST
- LEDGER.READ

### 4.6 OPERATOR / CERTIFYING_ENGINEER / SYSTEM

- Defined in model; to be seeded when introduced.
- SYSTEM MUST NOT be granted human-authority permissions.

## 5. Evidence and traceability

- Endpoint → Permission → Role(s) mapping: [ENDPOINT_AUTHZ_EVIDENCE.md](ENDPOINT_AUTHZ_EVIDENCE.md)
- Endpoint → DB mode: [ENDPOINT_DB_EVIDENCE.md](ENDPOINT_DB_EVIDENCE.md)
- Unit tests MUST prove:
  - endpoints enforce permissions (403 on missing permission)
  - role assignments match documentation
- Regulatory bundle MUST include AuthZ documentation and evidence.

## 6. Change control

Any change to:
- role definitions
- permission set
- endpoint mapping

MUST be reflected in documentation and tests in the same release.
