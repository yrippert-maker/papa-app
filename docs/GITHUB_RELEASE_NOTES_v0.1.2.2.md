## v0.1.2.2 — E2E Stability & Workspace Status

### E2E Infrastructure

- Port isolation: dev=3000, e2e=3100 (override via `E2E_PORT`)
- `run-e2e.sh` port guard: fail-fast with PID if port in use
- CI: explicit `E2E_PORT=3100` for reproducibility
- `docs/E2E_GUIDE.md`: runbook for port conflicts

### Workspace Status (health endpoint)

- Always returns 200 (no 500 on missing workspace/DB)
- `schemaReady`, `warning`, `error_code` for diagnostics
- E2E: status before/after init assertions

### Commands

```bash
npm run e2e
E2E_PORT=3200 npm run e2e
```
