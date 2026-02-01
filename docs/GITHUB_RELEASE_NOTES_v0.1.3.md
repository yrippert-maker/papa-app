## v0.1.3 — AuthZ Verification Evidence & UI RBAC Hardening

### AuthZ Verification

- **AUTHZ_VERIFY_RESULT.txt** in regulatory bundle (schema v1)
- **Runtime endpoint**: `GET /api/authz/verify` — same verification as bundle, permission: WORKSPACE.READ
- Scope: route_count, permission_count, role_count, unique_routes, permissions_valid, deny_by_default, deny_by_default_scope
- `deny_by_default_scope: "route_registry_only"` — clarifies that only routes in the registry have explicit permission; unknown routes denied
- timing_ms, Cache-Control: no-store
- Rate limit: 10 req/min

### UI & RBAC

- Centralized nav config (`lib/sidebar-nav`)
- Permission-first menu gating, empty group filtering
- `useWorkspaceStatus`: refetch after init, single-flight coalescing

### Bundle

- 20 files in regulatory zip
- AUTHZ_VERIFY_RESULT included in MANIFEST

### Commands

```bash
npm test
npm run bundle:regulatory
curl -b cookies.txt http://localhost:3000/api/authz/verify
```
