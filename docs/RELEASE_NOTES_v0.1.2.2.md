# Release Notes — v0.1.2.2

## Highlights

- **E2E port isolation**: dev=3000, e2e=3100 (configurable via `E2E_PORT`).
- **Port guard** in `run-e2e.sh`: fail-fast with PID diagnostic if port is in use.
- **CI hardening**: explicit `E2E_PORT=3100` for reproducible E2E.
- **docs/E2E_GUIDE.md**: runbook for E2E, port conflicts, diagnostics.
- **Workspace status**: health semantics, `schemaReady`, `warning`/`error_code`, never 500 on missing DB.

## Stability

- Prevents `EADDRINUSE` class regressions when running E2E with dev or other services.
- `GET /api/workspace/status` always returns 200 (no 500 on uninitialized workspace/DB).
- E2E: status before/after init assertions; `ok`, `dbExists` validated.

## Commands

```bash
npm run e2e          # alias for test:e2e
npm run test:e2e     # full flow (build, migrate, seed, server on 3100)
E2E_PORT=3200 npm run e2e   # override port
```

## Release Artifact

- **Release tag:** v0.1.2.2
- **Release commit (git SHA):** `84247b7cab1eed952f394bd6f0ca50f4a375b840`
