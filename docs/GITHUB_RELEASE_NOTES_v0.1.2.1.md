## v0.1.2.1 — NextAuth Hardening & AuthZ Evidence

### Security

- Fail-fast when `NEXTAUTH_SECRET` is missing in production.
- Dev fallback secret only when `ALLOW_DEV_FALLBACK_SECRET=1`.
- Safe redirect callback prevents open redirect.
- Rate-limit on `/api/ledger/verify` (10 req/min).

### Tooling

- `npm run smoke:auth` — providers/session curl checks.
- AuthZ verification in regulatory bundle (AUTHZ_VERIFY_RESULT.txt).
- CI: regulatory bundle step; route registry sync tests.
