# ENDPOINT_AUTHZ_EVIDENCE — v0.1.2

This document provides regulator-ready evidence for authorization enforcement:
Endpoint → Permission → Roles → DB Mode → Evidence.

**Source of truth (route registry):** `lib/authz/routes.ts`. This table is a regulatory snapshot. When adding routes, update both the registry and this document in the same release. CI test `authz-routes.test.ts` enforces deny-by-default and route count (17).

## 1. Normative statements

- Every endpoint MUST enforce at least one permission check server-side.
- Endpoints MUST NOT check roles directly; roles map to permissions.
- Deny-by-default: any endpoint without an explicit permission requirement MUST fail closed.
- DB mode (readonly/readwrite) is documented in [ENDPOINT_DB_EVIDENCE.md](ENDPOINT_DB_EVIDENCE.md).

## 2. Endpoint → Permission → Roles → DB Mode → Evidence

| Endpoint | Method | Permission | Allowed roles (min) | DB mode | Evidence |
|----------|--------|------------|---------------------|---------|----------|
| /api/admin/users | GET | ADMIN.MANAGE_USERS | ADMIN | readonly | E2E: admin 200; auditor 403 (no ADMIN.MANAGE_USERS) |
| /api/admin/users | POST | ADMIN.MANAGE_USERS | ADMIN | readwrite | E2E: create user 200 |
| /api/admin/users/[id] | PATCH | ADMIN.MANAGE_USERS | ADMIN | readwrite | E2E: role/reset |
| /api/tmc/items | GET | TMC.REQUEST.VIEW | AUDITOR (TMC.VIEW), ENGINEER, STOREKEEPER, MANAGER, ADMIN | readonly | PR-2.1 |
| /api/tmc/lots | GET | TMC.REQUEST.VIEW | AUDITOR (TMC.VIEW), ENGINEER, STOREKEEPER, MANAGER, ADMIN | readonly | PR-2.1 |
| /api/tmc/requests | GET | TMC.REQUEST.VIEW | AUDITOR (via TMC.VIEW), ENGINEER, MANAGER, ADMIN | readonly | E2E: auditor 200 (alias) |
| /api/inspection/cards | GET | INSPECTION.VIEW | AUDITOR, ENGINEER, STOREKEEPER, MANAGER, ADMIN | readonly | Inspection MVP |
| /api/inspection/cards/[id] | GET | INSPECTION.VIEW | AUDITOR, ENGINEER, STOREKEEPER, MANAGER, ADMIN | readonly | Inspection MVP |
| /api/files/list | GET | FILES.LIST | ENGINEER, STOREKEEPER, MANAGER, ADMIN, AUDITOR | readonly | E2E |
| /api/ai-inbox | GET | AI_INBOX.VIEW | AUDITOR, MANAGER, ADMIN | readonly | PR-2.2 |
| /api/files/upload | POST | FILES.UPLOAD | STOREKEEPER, MANAGER, ADMIN | readwrite | Unit: authz |
| /api/workspace/status | GET | WORKSPACE.READ | AUDITOR, ADMIN, ... | readonly | E2E: auditor 200 |
| /api/workspace/init | POST | WORKSPACE.READ | AUDITOR, ADMIN, ... | readwrite | E2E: init before status |
| /api/ledger/verify | GET | LEDGER.READ | AUDITOR, ADMIN | readonly | Unit: authz |
| /api/ledger/append | POST | LEDGER.APPEND | MANAGER, ADMIN | readwrite | E2E: auditor 403 |
| /api/authz/verify | GET | WORKSPACE.READ | AUDITOR, ADMIN | readonly | Runtime AuthZ verification (v0.1.3) |
| /api/system/verify | GET | WORKSPACE.READ | AUDITOR, ADMIN | readonly | Aggregator: AuthZ + Ledger snapshot (v0.1.6) |

> **Notes:**
> - If an endpoint is not listed here, it MUST NOT exist in the production build.
> - If an endpoint is added, it MUST be added to this table and covered by tests in the same release.

## 3. Evidence map (permission enforcement)

| Assertion (AC) | Test | File |
|----------------|------|------|
| AC-AUTHZ-01: unauthenticated requests are rejected | Unit | `__tests__/lib/authz.test.ts` |
| AC-AUTHZ-02: missing permission returns 403 | Unit | `__tests__/lib/authz.test.ts` |
| AC-AUTHZ-03: deny-by-default (no unprotected routes) | Unit | `__tests__/lib/authz-routes.test.ts` |
| AC-AUTHZ-04: role→permission mapping matches docs | Unit | `__tests__/lib/authz.test.ts` |
| AC-AUTHZ-05: auditor 403 on admin/write endpoints | E2E | `scripts/e2e-smoke.mjs` |

## 4. Operational constraint

Authorization does not grant autonomous decision authority. DB write operations remain reachable only via human-authorized routes, and AI components remain advisory-only. See [REGULATOR_PACKAGE.md](REGULATOR_PACKAGE.md).
