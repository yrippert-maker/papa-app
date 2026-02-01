# Release Notes — v0.1.3

## Highlights

- **AuthZ verification evidence**: `AUTHZ_VERIFY_RESULT.txt` in regulatory bundle with schema v1, scope (route_count, permission_count, role_count, deny_by_default).
- **Runtime AuthZ verify endpoint**: `GET /api/authz/verify` — same verification logic as bundle script, available at runtime (permission: WORKSPACE.READ).
- **UI RBAC hardening**: centralized nav config (`lib/sidebar-nav`), permission-first menu gating, `useWorkspaceStatus` refetch after init, single-flight request coalescing.
- **Bundle**: 20 files, AUTHZ_VERIFY_RESULT included in MANIFEST and sha256_manifest.

## Security / Safety

- AuthZ verification runs without server (bundle) and at runtime (API); both use identical logic.
- Rate limit on `/api/authz/verify` and `/api/ledger/verify` (10 req/min per client).
- Deny-by-default preserved; route registry expanded to 13 routes.

## Evidence and Traceability

- Regulatory bundle includes:
  - `AUTHZ_VERIFY_RESULT.txt` (schema v1: release, scope, checks)
  - `LEDGER_VERIFY_RESULT.txt`
  - `ENDPOINT_AUTHZ_EVIDENCE.md` updated with `/api/authz/verify`
- Unit tests: RBAC menu gating, empty group filtering, authz-verify-result invariants.

## Breaking Changes

- None functionally.
- Route count: 12 → 13 (new `/api/authz/verify`).

## How to Verify

```bash
npm test
npm run lint
npm run build
npm run bundle:regulatory
curl -H "Cookie: ..." http://localhost:3000/api/authz/verify
```

Verify that:
- all tests pass,
- regulatory bundle is generated successfully,
- `dist/regulatory-bundle-v0.1.3.zip` contains 20 files,
- `/api/authz/verify` returns `ok: true` when AuthZ is valid.

## Release Artifact

- **Release tag:** v0.1.3
- **Release commit (git SHA):** _fill after release_
- **Runtime fingerprint:** see [RELEASE_NOTES_v0.1.1.md](RELEASE_NOTES_v0.1.1.md) (unchanged)
