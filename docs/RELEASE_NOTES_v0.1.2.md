# Release Notes — v0.1.2

## Highlights

- RBAC hardening: permission-first authorization model enforced across all API endpoints.
- Deny-by-default: no endpoint is accessible without an explicit permission declaration.
- Regulatory evidence expanded with authorization model and endpoint–permission mapping.

## Security / Safety

- Authorization is enforced using permissions, not direct role checks.
- Roles map to permissions according to the least-privilege principle.
- All endpoints are protected by `requirePermission`; unprotected routes are rejected.
- Non-autonomy constraints remain unchanged: AI components are advisory-only.
- DB write access remains reachable only via human-authorized routes.

## Access Control Model

- Normative authorization model defined in `docs/AUTHZ_MODEL.md`.
- Endpoint-level evidence provided in `docs/ENDPOINT_AUTHZ_EVIDENCE.md`.
- Route registry (`lib/authz/routes.ts`) acts as the single source of truth.
- Unit tests enforce:
  - deny-by-default behavior,
  - full route coverage,
  - permission validity.

## Evidence and Traceability

- Regulatory bundle now includes:
  - `AUTHZ_MODEL.md`
  - `ENDPOINT_AUTHZ_EVIDENCE.md`
- Bundle manifest updated to include 19 files.
- Ledger integrity verification evidence remains included (`LEDGER_VERIFY_RESULT.txt`).

## Breaking Changes

- None functionally.
- Note: endpoints that were previously reachable without explicit permission now correctly return `403 Forbidden` (security tightening).

## How to Verify

```bash
npm test
npm run lint
npm run build
npm run bundle:regulatory
```

Verify that:
- all tests pass,
- regulatory bundle is generated successfully,
- `dist/regulatory-bundle-v0.1.2.zip` contains 19 files.

## Release Artifact

- **Release tag:** v0.1.2
- **Release commit (git SHA):** `7f9cef4bffba0b0a0c6d9ba7690174798481567c`
- **Runtime fingerprint:** see [RELEASE_NOTES_v0.1.1.md](RELEASE_NOTES_v0.1.1.md) (unchanged)
