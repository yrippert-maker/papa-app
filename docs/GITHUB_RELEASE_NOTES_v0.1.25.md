# Release v0.1.25 — Retention Alerts, Dashboard & Policy Manifest

## Overview
v0.1.25 добавляет alert integration для retention enforcement, read-only dashboard для аудиторов и versioned policy manifest.

---

## Key Changes

### 1. Alert Integration (CI/Cron)

Примеры bash/cron и GitHub Actions для раннего предупреждения:

```bash
# Alert on exit code 2 (violations found)
npm run retention:json
EXIT_CODE=$?
if [ $EXIT_CODE -eq 2 ]; then
  # Send alert
fi
```

See `docs/ops/ALERTS_COMPLIANCE.md` section 6.

### 2. Retention Dashboard

**URL:** `/compliance/retention`

**Features:**
- Policy manifest overview (version, parameters)
- Dead letter status (current file, archives, violations)
- Keys status (active, archived, revoked, violations)
- Summary: action required / all OK
- CLI commands reference

**Permission:** `COMPLIANCE.VIEW`

### 3. Policy Manifest

**File:** `docs/ops/RETENTION_POLICY_MANIFEST.md`

```yaml
version: "1.0.0"
updated_at: "2026-02-02"
targets:
  dead_letter:
    retention_days: 90
    max_size_mb: 100
    rotation_threshold_lines: 1000
  keys:
    archived_retention_years: 3
    revoked_retention: never_delete
  ledger:
    retention: permanent
    deletion: prohibited
```

Embedded in `lib/retention-service.ts` for runtime access.

---

## New Files

| File | Purpose |
|------|---------|
| `lib/retention-service.ts` | Service layer for retention data |
| `app/api/compliance/retention/route.ts` | API endpoint |
| `app/compliance/retention/page.tsx` | Dashboard UI |
| `docs/ops/RETENTION_POLICY_MANIFEST.md` | Versioned policy |
| `docs/ops/ALERTS_COMPLIANCE.md` | Updated with retention alerts |

---

## API

```
GET /api/compliance/retention
Permission: COMPLIANCE.VIEW
Returns: RetentionReport JSON
```

---

## Tests
- Total: **215 tests passed**
- Build: OK
- Routes: 30 registered

---

## Release Artifacts
- `dist/regulatory-bundle-v0.1.25.zip`
- SHA-256: **d230fe0d83e9482bf21c247f384e0032d6f805eb2dbebd9634308a0efe7dba49**
