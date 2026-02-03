# Release v0.1.24 — Retention Enforcement

## Overview
v0.1.24 добавляет unified retention enforcement script для автоматизации политик хранения данных.

---

## Key Changes

### Unified Retention Script

```bash
# Check retention status (safe, dry-run)
npm run retention:check

# Execute retention enforcement
npm run retention:run

# JSON output for CI/monitoring
npm run retention:json
```

### Options

| Option | Description |
|--------|-------------|
| `--dry-run` | Check only, no changes (default) |
| `--execute` | Actually delete/rotate files |
| `--retention-days=N` | Dead-letter retention (default: 90) |
| `--target=TARGET` | `dead-letter`, `keys`, `all` |
| `--json` | JSON output only |

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success, no issues |
| 1 | Error during execution |
| 2 | Violations found (dry-run mode) |

### Targets

| Target | Behavior |
|--------|----------|
| `dead-letter` | Rotate large files, delete old archives |
| `keys` | Report only (never auto-delete keys) |

### JSON Output

```json
{
  "timestamp": "2026-02-02T...",
  "mode": "dry-run",
  "targets": {
    "dead-letter": { "status": "ok", ... },
    "keys": { "status": "ok", ... }
  },
  "summary": {
    "targets_checked": 2,
    "actions_required": 0,
    "actions_taken": 0,
    "warnings": 0
  }
}
```

### Cron Integration

```bash
# /etc/cron.daily/papa-retention
cd /app && npm run retention:run >> /var/log/papa-retention.log 2>&1
```

---

## Files Changed

- `scripts/retention-enforce.mjs` — unified retention runner
- `package.json` — npm scripts
- `docs/ops/RETENTION_POLICY.md` — updated docs

---

## Tests
- Total: **215 tests passed**
- Build: OK

---

## Release Artifacts
- `dist/regulatory-bundle-v0.1.24.zip`
- SHA-256: **4cac1c5794d46be4c77eb4103b255727ee774084b7376387a98c13ed07d2a330**
