## v0.1.2 — RBAC Hardening & Authorization Evidence

### Highlights

- Permission-first RBAC enforced across all API endpoints.
- Deny-by-default guarantee: no unprotected routes.
- Regulatory bundle expanded with authorization model and evidence.

### Security & Compliance

- Roles map to permissions using least privilege.
- Endpoints enforce permissions server-side (`403` on missing permission).
- Non-autonomous AI and human-in-the-loop constraints preserved.
- Regulatory bundle now includes AuthZ documentation and endpoint evidence.

### Evidence

- AUTHZ_MODEL.md
- ENDPOINT_AUTHZ_EVIDENCE.md
- Updated REGULATORY_BUNDLE_MANIFEST.md (19 files total)
- Ledger integrity verification remains included.

### Notes

This release tightens access control without changing business logic or introducing autonomous behavior.
