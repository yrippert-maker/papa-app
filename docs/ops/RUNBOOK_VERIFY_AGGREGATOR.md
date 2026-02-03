# Runbook: Verify Aggregator

## 1. Mass Ledger Skipped

**Symptom:** `verify_aggregator_ledger_skipped_total` rising sharply.

**Possible causes:**
- RBAC misconfiguration (roles lost LEDGER.READ)
- New role without LEDGER.READ introduced
- Session/JWT not refreshed after permission change

**Steps:**
1. Check `reason` label: `LEDGER.READ not granted` is expected for read-only roles
2. Query DB: `SELECT role_code, perm_code FROM rbac_role_permission WHERE perm_code='LEDGER.READ'`
3. If unexpected: run migrations, verify role assignments in `migrations/`
4. If expected: no action (operational norm)

---

## 2. Spike 429 (Rate Limit)

**Symptom:** `verify_aggregator_rate_limited_total` or `requests_total{status="429"}` spike.

**Possible causes:**
- UI polling too aggressively
- Retry storm after transient error
- Shared client key (e.g. load balancer) hitting limit

**Steps:**
1. Check logs for `rate_limited: true` + `request_id`
2. Verify UI: no auto-refresh/polling on Verify page (by design: manual "Verify" only)
3. If load balancer: consider per-IP or per-session rate limit key
4. Temporary: increase limit in route (default 10/min) — document change

---

## 3. Ledger Source Errors

**Symptom:** `verify_aggregator_source_errors_total{source="ledger"}` rising.

**Possible causes:**
- Chain break (hash mismatch)
- DB corruption / SQLITE_BUSY
- Disk full / I/O errors

**Steps:**
1. Run `node scripts/verify-ledger.mjs` (with WORKSPACE_ROOT)
2. Check logs for `[ledger/verify]` or `[db] SQLITE_BUSY`
3. If chain break: investigate last appended event; consider recovery procedure
4. If SQLITE_BUSY: check concurrent writers; tune retry in `lib/db/sqlite.ts`

---

## 4. Inspection Source Errors

**Symptom:** `verify_aggregator_source_errors_total{source="inspection"}` rising.

**Possible causes:**
- `inspection_card` table missing (DB created before workspace init)
- DB read error

**Steps:**
1. Verify `inspection_card` exists: `SELECT COUNT(*) FROM inspection_card`
2. If missing: run workspace init (POST `/api/workspace/init`) or ensure DB schema includes inspection tables
3. Check logs for `[system/verify]` inspection-related errors

---

## 5. AuthZ Source Errors

**Symptom:** `verify_aggregator_source_errors_total{source="authz"}` rising.

**Possible causes:**
- Duplicate route in registry
- Invalid permission/role in DB
- Route/permission count mismatch

**Steps:**
1. Run `node scripts/verify-authz.mjs`
2. Check `lib/authz/routes.ts` vs `lib/authz/routes-export.mjs` sync
3. Run `npm test -- authz-routes-sync` to verify
4. Review recent deployments for route/permission changes

---

## 6. Latency Spike

**Symptom:** p95 latency > 500 ms (or baseline + 2x).

**Possible causes:**
- DB contention (SQLITE_BUSY retries)
- Cold start
- Disk I/O saturation

**Steps:**
1. Check `verify_aggregator_request_duration_ms_bucket` distribution
2. Search logs for `timing_ms` > 500
3. Check DB: `PRAGMA busy_timeout`, connection count
4. If persistent: consider read replica or connection pool tuning

---

## Recommended Alerts (Prometheus/Alertmanager)

*Thresholds are approximate; calibrate from baseline after deployment.*

```yaml
# p95 latency > 1s for 5m
- alert: VerifyAggregatorHighLatency
  expr: histogram_quantile(0.95, rate(verify_aggregator_request_duration_ms_bucket[5m])) > 1000
  for: 5m

# Error rate > 5% for 10m
- alert: VerifyAggregatorHighErrorRate
  expr: |
    sum(rate(verify_aggregator_requests_total{status!="200"}[10m])) 
    / sum(rate(verify_aggregator_requests_total[10m])) > 0.05
  for: 10m

# 429 spike: > 5 in 5m
- alert: VerifyAggregatorRateLimitSpike
  expr: increase(verify_aggregator_rate_limited_total[5m]) > 5
```
