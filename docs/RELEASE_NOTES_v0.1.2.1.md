# Release Notes — v0.1.2.1

## Highlights

- NextAuth hardening: fail-fast secret guard for production.
- Safe redirect callback to prevent open redirect.
- Added `npm run smoke:auth` for quick auth health checks.
- AuthZ verification automation (AUTHZ_VERIFY_RESULT.txt in bundle).
- Rate-limit on `/api/ledger/verify` (10 req/min per client).
- CI: regulatory bundle step; route registry sync tests.

## Security / Safety

- `NEXTAUTH_SECRET` is now required in production; missing secret fails fast.
- Controlled development fallback only with `ALLOW_DEV_FALLBACK_SECRET=1`.
- Redirect callback enforces same-origin or relative redirects only.
- Rate-limit on ledger verify endpoint reduces DoS risk.

## How to Verify

```bash
npm test
npm run lint
npm run build
npm run smoke:auth
npm run bundle:regulatory
```

## Breaking Changes

- Production runs fail fast if `NEXTAUTH_SECRET` is missing (intended tightening).

## Release Artifact

- **Release tag:** v0.1.2.1
- **Release commit (git SHA):** `5d8f412032de7119cc535c027125a78dc839df23`
- **CI run ID (optional):** <fill-if-applicable>
- **Runtime fingerprint:** see [RELEASE_NOTES_v0.1.1.md](RELEASE_NOTES_v0.1.1.md) (unchanged)
