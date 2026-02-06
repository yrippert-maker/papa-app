/**
 * Anomaly Detection Service
 * 
 * Detects and logs security anomalies with STRIDE threat mapping.
 */
import { getDbReadOnly, getDb, dbGet, dbAll } from './db';
import { appendLedgerEvent } from './ledger-hash';

// ========== Types ==========

export type AnomalyCategory = 'AUTH' | 'AUTHZ' | 'DATA' | 'KEY' | 'RES';
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface AnomalySource {
  ip: string | null;
  user_id: string | null;
  session_id: string | null;
  endpoint: string | null;
}

export interface Anomaly {
  anomaly_id: string;
  anomaly_type: string;
  category: AnomalyCategory;
  severity: Severity;
  details: Record<string, unknown>;
  source: AnomalySource;
  threat_mapping: string[];
  timestamp: string;
}

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

// ========== Anomaly Configurations ==========

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
  {
    id: 'AUTH-005',
    name: 'Default Credentials in Production',
    category: 'AUTH',
    severity: 'critical',
    detection: {
      type: 'pattern',
      params: { pattern: 'default_credentials_detected' },
    },
    response: {
      log_to_ledger: true,
      alert_level: 'critical',
      auto_action: 'block_startup',
    },
    threat_mapping: ['S3'],
    enabled: true,
  },
  {
    id: 'AUTHZ-002',
    name: 'Permission Denied Spike',
    category: 'AUTHZ',
    severity: 'high',
    detection: {
      type: 'threshold',
      params: { count: 10, window_minutes: 1 },
    },
    response: {
      log_to_ledger: true,
      alert_level: 'warning',
      auto_action: null,
    },
    threat_mapping: ['E1', 'E2'],
    enabled: true,
  },
  {
    id: 'AUTHZ-004',
    name: 'Self-Approval Attempt',
    category: 'AUTHZ',
    severity: 'high',
    detection: {
      type: 'pattern',
      params: { pattern: 'self_approval_attempt' },
    },
    response: {
      log_to_ledger: true,
      alert_level: 'warning',
      auto_action: null,
    },
    threat_mapping: ['E3'],
    enabled: true,
  },
  {
    id: 'DATA-001',
    name: 'Ledger Chain Broken',
    category: 'DATA',
    severity: 'critical',
    detection: {
      type: 'pattern',
      params: { pattern: 'hash_mismatch' },
    },
    response: {
      log_to_ledger: false, // Cannot log if ledger is broken
      alert_level: 'critical',
      auto_action: 'halt_writes',
    },
    threat_mapping: ['T1'],
    enabled: true,
  },
  {
    id: 'DATA-003',
    name: 'Policy Drift Detected',
    category: 'DATA',
    severity: 'medium',
    detection: {
      type: 'baseline_drift',
      params: { baseline_file: 'POLICY_HASH_BASELINE.json' },
    },
    response: {
      log_to_ledger: true,
      alert_level: 'warning',
      auto_action: null,
    },
    threat_mapping: ['T2'],
    enabled: true,
  },
  {
    id: 'KEY-002',
    name: 'Break-Glass Activation',
    category: 'KEY',
    severity: 'high',
    detection: {
      type: 'pattern',
      params: { pattern: 'break_glass_activated' },
    },
    response: {
      log_to_ledger: true,
      alert_level: 'critical',
      auto_action: null,
    },
    threat_mapping: ['E4', 'R3'],
    enabled: true,
  },
  {
    id: 'KEY-004',
    name: 'Revoked Key Usage',
    category: 'KEY',
    severity: 'critical',
    detection: {
      type: 'pattern',
      params: { pattern: 'revoked_key_in_signature' },
    },
    response: {
      log_to_ledger: true,
      alert_level: 'critical',
      auto_action: null,
    },
    threat_mapping: ['T3', 'I1'],
    enabled: true,
  },
  {
    id: 'RES-001',
    name: 'Rate Limit Exceeded',
    category: 'RES',
    severity: 'low',
    detection: {
      type: 'threshold',
      params: { count: 1, window_minutes: 1 },
    },
    response: {
      log_to_ledger: false,
      alert_level: 'none',
      auto_action: 'rate_limit_response',
    },
    threat_mapping: ['D1'],
    enabled: true,
  },
];

// ========== In-Memory Tracking ==========

interface EventTracker {
  events: Array<{ timestamp: number; ip?: string; user_id?: string }>;
}

const trackers = new Map<string, EventTracker>();

function getTracker(key: string): EventTracker {
  if (!trackers.has(key)) {
    trackers.set(key, { events: [] });
  }
  return trackers.get(key)!;
}

function cleanupOldEvents(tracker: EventTracker, windowMs: number): void {
  const cutoff = Date.now() - windowMs;
  tracker.events = tracker.events.filter(e => e.timestamp > cutoff);
}

// ========== Detection Functions ==========

export function detectThresholdAnomaly(
  configId: string,
  source: AnomalySource,
  groupKey: string
): Anomaly | null {
  const config = ANOMALY_CONFIGS.find(c => c.id === configId);
  if (!config || !config.enabled) return null;
  if (config.detection.type !== 'threshold') return null;
  
  const { count, window_minutes } = config.detection.params as {
    count: number;
    window_minutes: number;
  };
  
  const trackerKey = `${configId}:${groupKey}`;
  const tracker = getTracker(trackerKey);
  const windowMs = window_minutes * 60 * 1000;
  
  // Add current event
  tracker.events.push({
    timestamp: Date.now(),
    ip: source.ip ?? undefined,
    user_id: source.user_id ?? undefined,
  });
  
  // Cleanup old events
  cleanupOldEvents(tracker, windowMs);
  
  // Check threshold
  if (tracker.events.length >= count) {
    return createAnomaly(config, source, {
      threshold: count,
      actual_count: tracker.events.length,
      window_minutes,
      group_key: groupKey,
    });
  }
  
  return null;
}

export function detectPatternAnomaly(
  configId: string,
  source: AnomalySource,
  patternData: Record<string, unknown>
): Anomaly | null {
  const config = ANOMALY_CONFIGS.find(c => c.id === configId);
  if (!config || !config.enabled) return null;
  if (config.detection.type !== 'pattern') return null;
  
  return createAnomaly(config, source, patternData);
}

function createAnomaly(
  config: AnomalyConfig,
  source: AnomalySource,
  details: Record<string, unknown>
): Anomaly {
  return {
    anomaly_id: crypto.randomUUID(),
    anomaly_type: config.id,
    category: config.category,
    severity: config.severity,
    details,
    source,
    threat_mapping: config.threat_mapping,
    timestamp: new Date().toISOString(),
  };
}

// ========== Logging & Response ==========

export async function logAnomaly(anomaly: Anomaly): Promise<void> {
  const config = ANOMALY_CONFIGS.find(c => c.id === anomaly.anomaly_type);
  
  if (config?.response.log_to_ledger) {
    try {
      await appendLedgerEvent({
        event_type: `ANOMALY_${anomaly.category}_${anomaly.anomaly_type.replace('-', '_')}`,
        user_id: anomaly.source.user_id,
        payload: {
          anomaly_id: anomaly.anomaly_id,
          severity: anomaly.severity,
          details: anomaly.details,
          source: anomaly.source,
          threat_mapping: anomaly.threat_mapping,
        },
      });
    } catch (e) {
      // If ledger is broken, log to console at minimum
      console.error('[anomaly] Failed to log to ledger:', e);
    }
  }
  
  // Log to console based on severity
  const prefix = `[ANOMALY:${anomaly.severity.toUpperCase()}]`;
  console.log(`${prefix} ${anomaly.anomaly_type}: ${JSON.stringify(anomaly.details)}`);
}

// ========== Specific Detectors ==========

export async function detectFailedLogin(ip: string, userId: string | null): Promise<void> {
  const source: AnomalySource = {
    ip,
    user_id: userId,
    session_id: null,
    endpoint: '/api/auth/callback/credentials',
  };
  
  const anomaly = detectThresholdAnomaly('AUTH-001', source, ip);
  if (anomaly) {
    await logAnomaly(anomaly);
  }
}

export async function detectSelfApprovalAttempt(
  userId: string,
  requestId: string,
  ip: string | null
): Promise<void> {
  const source: AnomalySource = {
    ip,
    user_id: userId,
    session_id: null,
    endpoint: `/api/compliance/keys/requests/${requestId}/approve`,
  };
  
  const anomaly = detectPatternAnomaly('AUTHZ-004', source, {
    request_id: requestId,
    initiator_id: userId,
    approver_id: userId,
    reason: 'Self-approval attempt blocked',
  });
  
  if (anomaly) {
    await logAnomaly(anomaly);
  }
}

export async function detectPermissionDenied(
  userId: string,
  permission: string,
  endpoint: string,
  ip: string | null
): Promise<void> {
  const source: AnomalySource = {
    ip,
    user_id: userId,
    session_id: null,
    endpoint,
  };
  
  const groupKey = userId;
  const anomaly = detectThresholdAnomaly('AUTHZ-002', source, groupKey);
  
  if (anomaly) {
    anomaly.details.denied_permission = permission;
    await logAnomaly(anomaly);
  }
}

export async function detectBreakGlassActivation(
  userId: string,
  reason: string,
  expiresAt: string,
  ip: string | null
): Promise<void> {
  const source: AnomalySource = {
    ip,
    user_id: userId,
    session_id: null,
    endpoint: '/api/compliance/break-glass',
  };
  
  const anomaly = detectPatternAnomaly('KEY-002', source, {
    activated_by: userId,
    reason,
    expires_at: expiresAt,
  });
  
  if (anomaly) {
    await logAnomaly(anomaly);
  }
}

export function detectLedgerChainBroken(
  brokenAtEventId: number,
  expectedHash: string,
  actualHash: string
): void {
  const source: AnomalySource = {
    ip: null,
    user_id: null,
    session_id: null,
    endpoint: null,
  };
  
  const anomaly = detectPatternAnomaly('DATA-001', source, {
    broken_at_event_id: brokenAtEventId,
    expected_hash: expectedHash,
    actual_hash: actualHash,
  });
  
  if (anomaly) {
    // Cannot log to ledger if it's broken - log to console only
    console.error('[CRITICAL ANOMALY] Ledger chain broken!', anomaly.details);
  }
}

export async function detectPolicyDrift(
  policyId: string,
  expectedHash: string,
  actualHash: string
): Promise<void> {
  const source: AnomalySource = {
    ip: null,
    user_id: null,
    session_id: null,
    endpoint: null,
  };
  
  const anomaly = detectPatternAnomaly('DATA-003', source, {
    policy_id: policyId,
    expected_hash: expectedHash,
    actual_hash: actualHash,
    drift_detected: true,
  });
  
  if (anomaly) {
    await logAnomaly(anomaly);
  }
}

// ========== Query Functions ==========

export async function getRecentAnomalies(
  hours: number = 24,
  category?: AnomalyCategory
): Promise<Array<{
  event_id: number;
  event_type: string;
  created_at: string;
  payload: Record<string, unknown>;
}>> {
  const db = await getDbReadOnly();
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  
  let sql = `
    SELECT id, event_type, created_at, payload
    FROM ledger_events
    WHERE event_type LIKE 'ANOMALY_%'
    AND created_at >= ?
  `;
  const params: unknown[] = [cutoff];
  
  if (category) {
    sql += ` AND event_type LIKE ?`;
    params.push(`ANOMALY_${category}_%`);
  }
  
  sql += ` ORDER BY created_at DESC LIMIT 100`;
  
  const rows = (await dbAll(db, sql, ...params)) as Array<{
    id: number;
    event_type: string;
    created_at: string;
    payload: string;
  }>;
  
  return rows.map(r => ({
    event_id: r.id,
    event_type: r.event_type,
    created_at: r.created_at,
    payload: JSON.parse(r.payload),
  }));
}

export async function getAnomalyStats(days: number = 7): Promise<{
  total: number;
  by_category: Record<AnomalyCategory, number>;
  by_severity: Record<Severity, number>;
}> {
  const db = await getDbReadOnly();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  
  const rows = (await dbAll(db, `
    SELECT event_type, payload
    FROM ledger_events
    WHERE event_type LIKE 'ANOMALY_%'
    AND created_at >= ?
  `, cutoff)) as Array<{ event_type: string; payload: string }>;
  
  const byCategory: Record<string, number> = {
    AUTH: 0,
    AUTHZ: 0,
    DATA: 0,
    KEY: 0,
    RES: 0,
  };
  
  const bySeverity: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  
  for (const row of rows) {
    const payload = JSON.parse(row.payload);
    const category = row.event_type.split('_')[1] as AnomalyCategory;
    if (byCategory[category] !== undefined) {
      byCategory[category]++;
    }
    if (payload.severity && bySeverity[payload.severity] !== undefined) {
      bySeverity[payload.severity]++;
    }
  }
  
  return {
    total: rows.length,
    by_category: byCategory as Record<AnomalyCategory, number>,
    by_severity: bySeverity as Record<Severity, number>,
  };
}
