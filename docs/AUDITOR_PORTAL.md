# Auditor Portal (Sprint 6)

Read-only portal over S3 ledger/rollups: list days, view entries, presigned download, ack proxy. No S3 credentials in the browser.

## Architecture

- **Portal API** (`services/auditor-portal-api`): Express server that reads S3 (ledger/rollups), optional ack proxy. Auth: `none` | `api_key` | `oidc` (JWT via JWKS).
- **Portal UI** (`apps/auditor-portal`): Vite + React Router. Calls portal API; supports api_key or Bearer token.

## Portal API env (S3)

```bash
# required
LEDGER_BUCKET=your-ledger-bucket
LEDGER_PREFIX=ledger
LEDGER_ROLLUP_PREFIX=ledger-rollups
AWS_REGION=eu-west-1

# auth (choose one)
PORTAL_AUTH_MODE=none
# or
PORTAL_AUTH_MODE=api_key
PORTAL_API_KEY=...

# or OIDC
# PORTAL_AUTH_MODE=oidc
# PORTAL_OIDC_JWKS_URL=https://.../.well-known/jwks.json
# PORTAL_OIDC_ISSUER=https://...
# PORTAL_OIDC_AUDIENCE=...

# optional ack proxy
ACK_SERVER_URL=http://issue-ack-server:8787
ACK_API_KEY=...

PORT=8790
```

## Portal UI env

```bash
VITE_PORTAL_API_URL=http://localhost:8790
VITE_PORTAL_API_KEY=...       # when api_key mode
# VITE_PORTAL_BEARER=...      # when oidc mode (or set via reverse proxy)
```

## Run locally

**Terminal 1 — Portal API**

```bash
cd services/auditor-portal-api
npm i
LEDGER_BUCKET=your-bucket AWS_REGION=us-east-1 PORTAL_AUTH_MODE=none npm start
```

**Terminal 2 — Portal UI**

```bash
cd apps/auditor-portal
npm i
VITE_PORTAL_API_URL=http://localhost:8790 npm run dev
```

Then open http://localhost:5179 (Vite default port is 5173; we use 5179 in config).

## Root scripts (from repo root)

```bash
npm run portal:api:dev   # start portal API (requires LEDGER_BUCKET etc. in env)
npm run portal:ui:dev    # start portal UI
```

## API endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /v1/days?from=YYYY-MM-DD&to=YYYY-MM-DD` | List days with ledger entries + rollup_exists |
| `GET /v1/day/:date/entries?limit=200&include=0` | List keys for day; include=1 fetches JSON |
| `GET /v1/rollup/:date` | rollup.json + manifest.json for date |
| `GET /v1/object?key=...&bucket=...` | Read JSON object |
| `GET /v1/presign?key=...&bucket=...&expires=900` | Presigned download URL |
| `GET /v1/ack/:fingerprint` | Ack status (proxy to ack server) |
| `POST /v1/ack` | Upsert ack (proxy) |

## DoD

- /days — list days with rollup flag
- /day/:date — rollup summary + ledger entries table
- /entry?key=... — entry detail, signature/policy/anchoring, top issues + runbook links, ack status, presign button
- Presigned download for ledger-entry.json (and any key/bucket)
- Auth: none | api_key | oidc (SSO-ready)
- Ack: UI sees ack, can acknowledge via portal API → ack server
