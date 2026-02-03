# Anomaly Classification System

**Document ID:** SEC-ANOMALY-001  
**Version:** 1.0.0  
**Last Updated:** 2026-02-02

---

## 1. Overview

This document defines the classification system for security anomalies detected in Papa App. Each anomaly is mapped to potential threat classes (STRIDE) and includes detection methods, severity assessment, and response procedures.

---

## 2. Anomaly Categories

### 2.1 Authentication Anomalies (AUTH)

| ID | Anomaly | STRIDE | Severity | Detection |
|----|---------|--------|----------|-----------|
| AUTH-001 | Multiple failed logins from same IP | Spoofing | Medium | `failed_login_count >= 5 in 5min` |
| AUTH-002 | Login from new location/device | Spoofing | Low | IP geolocation change |
| AUTH-003 | Session used from multiple IPs | Spoofing | High | IP change during session |
| AUTH-004 | Unusual login time | Spoofing | Low | Outside business hours |
| AUTH-005 | Default credentials in production | Spoofing | Critical | Environment check |

#### AUTH-001: Multiple Failed Logins

**Detection Logic:**
```typescript
interface FailedLoginAnomaly {
  anomaly_type: 'AUTH_FAILED_LOGIN_SPIKE';
  ip_address: string;
  user_attempted: string | null;
  attempt_count: number;
  window_minutes: number;
  first_attempt: string;
  last_attempt: string;
}

// Detection
if (failedAttempts.filter(a => a.ip === ip && a.time > now - 5min).length >= 5) {
  emitAnomaly('AUTH_FAILED_LOGIN_SPIKE', { ip, count: 5, window: 5 });
}
```

**Response:**
1. Log anomaly to ledger (`ANOMALY_AUTH_FAILED_LOGINS`)
2. Temporary IP block (15 minutes)
3. Alert security team if count >= 10

**Mapped Threats:** S2 (Credential stuffing), D1 (API flooding)

---

### 2.2 Authorization Anomalies (AUTHZ)

| ID | Anomaly | STRIDE | Severity | Detection |
|----|---------|--------|----------|-----------|
| AUTHZ-001 | Access to forbidden resource | Elevation | Medium | 403 response logged |
| AUTHZ-002 | Permission denied spike | Elevation | High | `403_count >= 10 in 1min` |
| AUTHZ-003 | Role change without admin action | Elevation | Critical | Role change outside flow |
| AUTHZ-004 | Self-approval attempt | Elevation | High | Initiator == Approver |

#### AUTHZ-002: Permission Denied Spike

**Detection Logic:**
```typescript
interface PermissionDeniedAnomaly {
  anomaly_type: 'AUTHZ_PERMISSION_DENIED_SPIKE';
  user_id: string;
  denied_permissions: string[];
  denial_count: number;
  window_minutes: number;
}

// Detection
const recentDenials = getDenials(userId, window: 1min);
if (recentDenials.length >= 10) {
  emitAnomaly('AUTHZ_PERMISSION_DENIED_SPIKE', {
    user_id: userId,
    denied_permissions: unique(recentDenials.map(d => d.permission)),
    denial_count: recentDenials.length,
  });
}
```

**Response:**
1. Log anomaly to ledger
2. Alert security team
3. Consider temporary account suspension

**Mapped Threats:** E1 (RBAC bypass attempt), E2 (Role manipulation)

---

### 2.3 Data Integrity Anomalies (DATA)

| ID | Anomaly | STRIDE | Severity | Detection |
|----|---------|--------|----------|-----------|
| DATA-001 | Ledger chain broken | Tampering | Critical | Hash mismatch |
| DATA-002 | Snapshot hash invalid | Tampering | Critical | Verification failure |
| DATA-003 | Policy drift detected | Tampering | Medium | Baseline hash mismatch |
| DATA-004 | Unexpected file modification | Tampering | Medium | File hash change |

#### DATA-001: Ledger Chain Broken

**Detection Logic:**
```typescript
interface LedgerChainAnomaly {
  anomaly_type: 'DATA_LEDGER_CHAIN_BROKEN';
  broken_at_event_id: number;
  expected_hash: string;
  actual_hash: string;
  previous_hash: string;
}

// Detection (in verifyLedgerChain)
if (computedHash !== event.event_hash) {
  emitAnomaly('DATA_LEDGER_CHAIN_BROKEN', {
    broken_at_event_id: event.id,
    expected_hash: event.event_hash,
    actual_hash: computedHash,
    previous_hash: previousHash,
  });
}
```

**Response:**
1. **IMMEDIATE**: Halt all write operations
2. Alert security team (Critical)
3. Preserve evidence (database snapshot)
4. Initiate incident response procedure

**Mapped Threats:** T1 (Ledger tampering)

---

### 2.4 Key Management Anomalies (KEY)

| ID | Anomaly | STRIDE | Severity | Detection |
|----|---------|--------|----------|-----------|
| KEY-001 | Key operation without approval | Elevation | Critical | Missing request record |
| KEY-002 | Break-glass activation | Repudiation | High | Break-glass event |
| KEY-003 | Multiple key rotations | Information | Medium | `rotation_count >= 3 in 24h` |
| KEY-004 | Key used after revocation | Tampering | Critical | Revoked key in signature |
| KEY-005 | Request approval timeout spike | Denial | Medium | `expired_count >= 5 in 7d` |

#### KEY-002: Break-Glass Activation

**Detection Logic:**
```typescript
interface BreakGlassAnomaly {
  anomaly_type: 'KEY_BREAK_GLASS_ACTIVATED';
  activated_by: string;
  reason: string;
  activated_at: string;
  expires_at: string;
  actions_during: string[];
}

// Detection (always emitted on break-glass)
emitAnomaly('KEY_BREAK_GLASS_ACTIVATED', {
  activated_by: securityOfficerId,
  reason: input.reason,
  activated_at: now,
  expires_at: now + 4h,
  actions_during: [],
});
```

**Response:**
1. Log to ledger with full context
2. Alert all Security Officers
3. Notify Security Council
4. **Mandatory** post-mortem within 72 hours

**Mapped Threats:** E4 (Break-glass abuse), R3 (Denied break-glass)

---

### 2.5 Resource Anomalies (RES)

| ID | Anomaly | STRIDE | Severity | Detection |
|----|---------|--------|----------|-----------|
| RES-001 | Rate limit exceeded | Denial | Low | 429 response |
| RES-002 | Large file upload | Denial | Medium | `file_size > 40MB` |
| RES-003 | Storage quota approaching | Denial | Medium | `usage > 80%` |
| RES-004 | Dead letter queue growth | Denial | Medium | `dlq_size > 100` |
| RES-005 | Database lock contention | Denial | High | `lock_wait > 5s` |

#### RES-001: Rate Limit Exceeded

**Detection Logic:**
```typescript
interface RateLimitAnomaly {
  anomaly_type: 'RES_RATE_LIMIT_EXCEEDED';
  ip_address: string;
  user_id: string | null;
  endpoint: string;
  limit: number;
  window_seconds: number;
  request_count: number;
}
```

**Response:**
1. Return 429 with Retry-After header
2. Log if persistent (> 10 in 1 hour)
3. Consider IP blocking for severe cases

**Mapped Threats:** D1 (API flooding)

---

## 3. Anomaly Event Schema

All anomalies are logged to the ledger using this schema:

```typescript
interface AnomalyEvent {
  event_type: `ANOMALY_${string}`;
  timestamp: string;
  anomaly_id: string;
  anomaly_type: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: 'AUTH' | 'AUTHZ' | 'DATA' | 'KEY' | 'RES';
  details: Record<string, unknown>;
  source: {
    ip: string | null;
    user_id: string | null;
    session_id: string | null;
    endpoint: string | null;
  };
  threat_mapping: string[]; // STRIDE threat IDs
  acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
}
```

---

## 4. Severity Levels

| Level | Response Time | Escalation | Examples |
|-------|--------------|------------|----------|
| **Critical** | Immediate | Security Council | Ledger tampering, Key compromise |
| **High** | < 1 hour | Security Officer | Break-glass, Permission spike |
| **Medium** | < 4 hours | On-call | Policy drift, Rate limit abuse |
| **Low** | < 24 hours | Queue | New device login |
| **Info** | None | Log only | Single failed login |

---

## 5. Anomaly Detection Service

```typescript
// lib/anomaly-detection-service.ts

export interface AnomalyConfig {
  id: string;
  name: string;
  category: AnomalyCategory;
  severity: Severity;
  detection: {
    type: 'threshold' | 'pattern' | 'baseline_drift';
    params: Record<string, unknown>;
  };
  response: {
    log_to_ledger: boolean;
    alert_level: 'none' | 'info' | 'warning' | 'critical';
    auto_action: string | null;
  };
  threat_mapping: string[];
  enabled: boolean;
}

export const ANOMALY_CONFIGS: AnomalyConfig[] = [
  {
    id: 'AUTH-001',
    name: 'Failed Login Spike',
    category: 'AUTH',
    severity: 'medium',
    detection: {
      type: 'threshold',
      params: { count: 5, window_minutes: 5 },
    },
    response: {
      log_to_ledger: true,
      alert_level: 'warning',
      auto_action: 'temp_ip_block',
    },
    threat_mapping: ['S2', 'D1'],
    enabled: true,
  },
  // ... more configs
];
```

---

## 6. Integration with Monitoring

### 6.1 Prometheus Metrics

```
# Anomaly counts by type
papa_anomalies_total{type="AUTH_FAILED_LOGIN_SPIKE",severity="medium"} 5
papa_anomalies_total{type="DATA_LEDGER_CHAIN_BROKEN",severity="critical"} 0

# Active anomalies (unacknowledged)
papa_anomalies_active{category="AUTH"} 2
papa_anomalies_active{category="DATA"} 0
```

### 6.2 Alert Rules

```yaml
# prometheus/alerts.yml
groups:
  - name: security_anomalies
    rules:
      - alert: CriticalAnomalyDetected
        expr: increase(papa_anomalies_total{severity="critical"}[5m]) > 0
        labels:
          severity: critical
        annotations:
          summary: "Critical security anomaly detected"
          
      - alert: AnomalySpike
        expr: increase(papa_anomalies_total[5m]) > 10
        labels:
          severity: warning
        annotations:
          summary: "Anomaly detection spike"
```

---

## 7. Response Runbook

### 7.1 Critical Anomaly Response

1. **Acknowledge** the anomaly in the system
2. **Assess** the scope and impact
3. **Contain** if active threat (block IP, suspend account)
4. **Investigate** root cause using ledger events
5. **Remediate** the vulnerability
6. **Document** in incident report
7. **Review** detection rules for improvements

### 7.2 Post-Incident Actions

- Update threat model if new threat discovered
- Add/adjust anomaly detection rules
- Schedule lessons learned session
- Update this document if needed

---

## 8. Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-02 | Initial release |
