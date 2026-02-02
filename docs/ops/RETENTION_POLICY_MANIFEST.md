# Retention Policy Manifest

## Version Info

```yaml
version: "1.0.0"
updated_at: "2026-02-02"
author: "compliance-team"
status: "active"
```

---

## Policy Definition

This manifest defines the official retention policies for all compliance-critical data.
It is embedded in code (`lib/retention-service.ts`) and enforced by `scripts/retention-enforce.mjs`.

---

## 1. Dead Letter Files

**Location:** `{WORKSPACE_ROOT}/00_SYSTEM/ledger-dead-letter.jsonl`

| Parameter | Value | Enforcement |
|-----------|-------|-------------|
| `retention_days` | 90 | `retention:run` deletes archives older than 90 days |
| `max_size_mb` | 100 | `retention:check` warns when exceeded |
| `rotation_threshold_lines` | 1000 | `retention:run` rotates when exceeded |

### Rationale
- 90 days sufficient for incident investigation
- Size limits prevent disk exhaustion
- Automatic rotation maintains performance

### Deletion Rules
1. Archives deleted only after retention period
2. Never delete current file (rotate first)
3. Log all deletions in ops log

---

## 2. Signing Keys

**Location:** `{WORKSPACE_ROOT}/00_SYSTEM/keys/`

| Parameter | Value | Enforcement |
|-----------|-------|-------------|
| `archived_retention_years` | 3 | Report only (no auto-delete) |
| `revoked_retention` | `never_delete` | Not enforced (immutable) |

### Rationale
- 3 years minimum to cover evidence lifecycle
- Revoked keys must be preserved for verification of old evidence
- Private keys only in `active/` directory

### Deletion Rules
1. **Archived keys**: Review after 3 years, manual deletion only
2. **Revoked keys**: Never delete
3. **Private keys**: Never archived, only rotated

---

## 3. Ledger Events

**Table:** `ledger_events`

| Parameter | Value | Enforcement |
|-----------|-------|-------------|
| `retention` | `permanent` | N/A |
| `deletion` | `prohibited` | N/A |

### Rationale
- Immutable audit trail
- Chain integrity depends on all events
- Regulatory requirement: complete history

### Deletion Rules
1. **Never delete** ledger events
2. Archival not supported
3. Database compaction prohibited

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-02 | Initial policy definition |

---

## Compliance Notes

### Regulatory Mapping
- **GDPR**: Dead letter may contain PII → 90-day retention appropriate
- **SOX**: Ledger immutability satisfies audit trail requirements
- **Internal**: Key retention supports evidence verification SLA

### Enforcement Automation

```bash
# Daily cron job
0 2 * * * cd /app && npm run retention:run >> /var/log/papa-retention.log 2>&1

# CI/CD check
npm run retention:check
# Exit code 2 = violations found → fail pipeline
```

### Dashboard
Access retention status at `/compliance/retention` (requires `COMPLIANCE.VIEW`).

---

## Change Process

1. Update `lib/retention-service.ts` → `RETENTION_POLICY`
2. Update this manifest
3. Bump `version` field
4. Create PR with changelog
5. Review by compliance officer
6. Deploy and verify via dashboard
