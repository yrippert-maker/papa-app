/**
 * Governance Resilience Service
 * Break-glass post-mortem, anomaly detection, rate limits per approver.
 */
import { createHash } from 'crypto';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { WORKSPACE_ROOT } from './config';
import { getDbReadOnly, getDb, dbGet, dbAll, dbRun } from './db';
import { canonicalJSON, computeEventHash } from './ledger-hash';

// ========== Types ==========

export type PostMortemStatus = 'pending' | 'in_progress' | 'completed' | 'overdue';

export type BreakGlassPostMortem = {
  postmortem_id: string;
  break_glass_id: string;
  activated_by: string;
  activated_at: string;
  deactivated_at: string | null;
  actions_taken: Array<{ action: string; timestamp: string; details: string }>;
  status: PostMortemStatus;
  due_date: string;
  assigned_to: string | null;
  findings: string | null;
  root_cause: string | null;
  remediation: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AnomalyType = 
  | 'FREQUENT_APPROVALS'
  | 'NEAR_EXPIRY_ABUSE'
  | 'SAME_PAIR_PATTERN'
  | 'BURST_REQUESTS'
  | 'OFF_HOURS_ACTIVITY';

export type AnomalyAlert = {
  alert_id: string;
  type: AnomalyType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detected_at: string;
  details: Record<string, unknown>;
  actors: string[];
  acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
};

export type ApproverRateLimit = {
  user_id: string;
  window_hours: number;
  max_approvals: number;
  current_count: number;
  window_start: string;
  blocked_until: string | null;
};

// ========== Configuration ==========

const POSTMORTEM_DEADLINE_HOURS = 72; // 3 days
const APPROVAL_RATE_LIMIT_WINDOW_HOURS = 24;
const APPROVAL_RATE_LIMIT_MAX = 10;
const ANOMALY_THRESHOLDS = {
  FREQUENT_APPROVALS: 5,      // per day per approver
  NEAR_EXPIRY_THRESHOLD_MIN: 5, // approved within 5 min of expiry
  SAME_PAIR_THRESHOLD: 3,     // same initiator-approver pair
  BURST_THRESHOLD: 5,         // requests in 30 min
  OFF_HOURS_START: 22,        // 10 PM
  OFF_HOURS_END: 6,           // 6 AM
};

// ========== Storage ==========

const DATA_DIR = join(WORKSPACE_ROOT, '00_SYSTEM', 'governance');

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function loadPostMortems(): BreakGlassPostMortem[] {
  const file = join(DATA_DIR, 'postmortems.json');
  if (!existsSync(file)) return [];
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

function savePostMortems(items: BreakGlassPostMortem[]): void {
  ensureDataDir();
  writeFileSync(join(DATA_DIR, 'postmortems.json'), JSON.stringify(items, null, 2), 'utf8');
}

function loadAnomalies(): AnomalyAlert[] {
  const file = join(DATA_DIR, 'anomalies.json');
  if (!existsSync(file)) return [];
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

function saveAnomalies(items: AnomalyAlert[]): void {
  ensureDataDir();
  writeFileSync(join(DATA_DIR, 'anomalies.json'), JSON.stringify(items, null, 2), 'utf8');
}

function loadRateLimits(): ApproverRateLimit[] {
  const file = join(DATA_DIR, 'rate-limits.json');
  if (!existsSync(file)) return [];
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

function saveRateLimits(items: ApproverRateLimit[]): void {
  ensureDataDir();
  writeFileSync(join(DATA_DIR, 'rate-limits.json'), JSON.stringify(items, null, 2), 'utf8');
}

// ========== Break-Glass Post-Mortem ==========

export async function createPostMortem(breakGlassEvent: {
  activated_by: string;
  activated_at: string;
  deactivated_at: string | null;
  actions_taken: Array<{ action: string; timestamp: string; details: string }>;
}): Promise<BreakGlassPostMortem> {
  const postmortems = loadPostMortems();
  
  const dueDate = new Date(breakGlassEvent.deactivated_at ?? new Date());
  dueDate.setHours(dueDate.getHours() + POSTMORTEM_DEADLINE_HOURS);
  
  const pm: BreakGlassPostMortem = {
    postmortem_id: crypto.randomUUID(),
    break_glass_id: crypto.randomUUID(), // Should link to actual break-glass ID
    activated_by: breakGlassEvent.activated_by,
    activated_at: breakGlassEvent.activated_at,
    deactivated_at: breakGlassEvent.deactivated_at,
    actions_taken: breakGlassEvent.actions_taken,
    status: 'pending',
    due_date: dueDate.toISOString(),
    assigned_to: null,
    findings: null,
    root_cause: null,
    remediation: null,
    approved_by: null,
    approved_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  postmortems.push(pm);
  savePostMortems(postmortems);
  
  // Log to ledger
  await logGovernanceEvent('POSTMORTEM_CREATED', {
    postmortem_id: pm.postmortem_id,
    break_glass_activated_by: breakGlassEvent.activated_by,
    due_date: pm.due_date,
  }, 'system');
  
  return pm;
}

export async function updatePostMortem(postmortemId: string, update: {
  assigned_to?: string;
  findings?: string;
  root_cause?: string;
  remediation?: string;
  status?: PostMortemStatus;
}, updatedBy: string): Promise<BreakGlassPostMortem | null> {
  const postmortems = loadPostMortems();
  const pm = postmortems.find(p => p.postmortem_id === postmortemId);
  
  if (!pm) return null;
  
  if (update.assigned_to !== undefined) pm.assigned_to = update.assigned_to;
  if (update.findings !== undefined) pm.findings = update.findings;
  if (update.root_cause !== undefined) pm.root_cause = update.root_cause;
  if (update.remediation !== undefined) pm.remediation = update.remediation;
  if (update.status !== undefined) pm.status = update.status;
  pm.updated_at = new Date().toISOString();
  
  savePostMortems(postmortems);
  
  // Log update
  await logGovernanceEvent('POSTMORTEM_UPDATED', {
    postmortem_id: postmortemId,
    updated_by: updatedBy,
    new_status: pm.status,
  }, updatedBy);
  
  return pm;
}

export async function approvePostMortem(postmortemId: string, approvedBy: string): Promise<BreakGlassPostMortem | null> {
  const postmortems = loadPostMortems();
  const pm = postmortems.find(p => p.postmortem_id === postmortemId);
  
  if (!pm) return null;
  if (pm.activated_by === approvedBy) {
    throw new Error('Post-mortem cannot be approved by the person who activated break-glass');
  }
  if (!pm.findings || !pm.root_cause || !pm.remediation) {
    throw new Error('Post-mortem must have findings, root cause, and remediation before approval');
  }
  
  pm.status = 'completed';
  pm.approved_by = approvedBy;
  pm.approved_at = new Date().toISOString();
  pm.updated_at = new Date().toISOString();
  
  savePostMortems(postmortems);
  
  // Log approval
  await logGovernanceEvent('POSTMORTEM_APPROVED', {
    postmortem_id: postmortemId,
    approved_by: approvedBy,
  }, approvedBy);
  
  return pm;
}

export function listPostMortems(status?: PostMortemStatus): BreakGlassPostMortem[] {
  const postmortems = loadPostMortems();
  
  // Check for overdue
  const now = new Date();
  for (const pm of postmortems) {
    if (pm.status === 'pending' || pm.status === 'in_progress') {
      if (new Date(pm.due_date) < now) {
        pm.status = 'overdue';
      }
    }
  }
  savePostMortems(postmortems);
  
  if (status) return postmortems.filter(p => p.status === status);
  return postmortems;
}

// ========== Anomaly Detection ==========

export async function detectAnomalies(): Promise<AnomalyAlert[]> {
  const newAnomalies: AnomalyAlert[] = [];
  const db = await getDbReadOnly();
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  // 1. Frequent approvals per user
  const approvals = (await dbAll(db, `
    SELECT payload_json, actor_id, created_at FROM ledger_events
    WHERE event_type = 'KEY_REQUEST_APPROVED'
    AND created_at >= ?
  `, dayAgo.toISOString())) as { payload_json: string; actor_id: string; created_at: string }[];
  
  const approvalsByUser: Record<string, number> = {};
  for (const a of approvals) {
    approvalsByUser[a.actor_id] = (approvalsByUser[a.actor_id] || 0) + 1;
  }
  
  for (const [userId, count] of Object.entries(approvalsByUser)) {
    if (count >= ANOMALY_THRESHOLDS.FREQUENT_APPROVALS) {
      newAnomalies.push({
        alert_id: crypto.randomUUID(),
        type: 'FREQUENT_APPROVALS',
        severity: count >= 10 ? 'high' : 'medium',
        detected_at: now.toISOString(),
        details: { user_id: userId, approval_count: count, window: '24h' },
        actors: [userId],
        acknowledged: false,
        acknowledged_by: null,
        acknowledged_at: null,
      });
    }
  }
  
  // 2. Near-expiry abuse (approved within threshold of expiry)
  const requests = (await dbAll(db, `
    SELECT * FROM key_lifecycle_requests
    WHERE status = 'APPROVED' OR status = 'EXECUTED'
    AND approved_at >= ?
  `, dayAgo.toISOString())) as Array<{
    id: string;
    initiator_id: string;
    approver_id: string;
    created_at: string;
    approved_at: string;
    expires_at: string;
  }>;
  
  for (const req of requests) {
    if (!req.approved_at || !req.expires_at) continue;
    const approvedTime = new Date(req.approved_at).getTime();
    const expiresTime = new Date(req.expires_at).getTime();
    const timeToExpiry = (expiresTime - approvedTime) / 60000; // minutes
    
    if (timeToExpiry <= ANOMALY_THRESHOLDS.NEAR_EXPIRY_THRESHOLD_MIN && timeToExpiry > 0) {
      newAnomalies.push({
        alert_id: crypto.randomUUID(),
        type: 'NEAR_EXPIRY_ABUSE',
        severity: 'high',
        detected_at: now.toISOString(),
        details: { request_id: req.id, minutes_to_expiry: Math.round(timeToExpiry) },
        actors: [req.initiator_id, req.approver_id],
        acknowledged: false,
        acknowledged_by: null,
        acknowledged_at: null,
      });
    }
  }
  
  // 3. Same initiator-approver pair pattern
  const pairCounts: Record<string, number> = {};
  for (const req of requests) {
    if (!req.approver_id) continue;
    const pair = `${req.initiator_id}:${req.approver_id}`;
    pairCounts[pair] = (pairCounts[pair] || 0) + 1;
  }
  
  for (const [pair, count] of Object.entries(pairCounts)) {
    if (count >= ANOMALY_THRESHOLDS.SAME_PAIR_THRESHOLD) {
      const [initiator, approver] = pair.split(':');
      newAnomalies.push({
        alert_id: crypto.randomUUID(),
        type: 'SAME_PAIR_PATTERN',
        severity: 'medium',
        detected_at: now.toISOString(),
        details: { initiator, approver, count, window: '24h' },
        actors: [initiator, approver],
        acknowledged: false,
        acknowledged_by: null,
        acknowledged_at: null,
      });
    }
  }
  
  // 4. Burst requests (many in short window)
  const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);
  const recentRequests = (await dbGet(db, `
    SELECT COUNT(*) as count FROM key_lifecycle_requests
    WHERE created_at >= ?
  `, thirtyMinAgo.toISOString())) as { count: number };
  
  if (recentRequests.count >= ANOMALY_THRESHOLDS.BURST_THRESHOLD) {
    newAnomalies.push({
      alert_id: crypto.randomUUID(),
      type: 'BURST_REQUESTS',
      severity: 'high',
      detected_at: now.toISOString(),
      details: { request_count: recentRequests.count, window: '30min' },
      actors: [],
      acknowledged: false,
      acknowledged_by: null,
      acknowledged_at: null,
    });
  }
  
  // 5. Off-hours activity
  const currentHour = now.getUTCHours();
  if (currentHour >= ANOMALY_THRESHOLDS.OFF_HOURS_START || currentHour < ANOMALY_THRESHOLDS.OFF_HOURS_END) {
    const offHoursActivity = (await dbGet(db, `
      SELECT COUNT(*) as count FROM ledger_events
      WHERE event_type LIKE 'KEY_%'
      AND created_at >= ?
    `, new Date(now.getTime() - 60 * 60 * 1000).toISOString())) as { count: number };
    
    if (offHoursActivity.count > 0) {
      newAnomalies.push({
        alert_id: crypto.randomUUID(),
        type: 'OFF_HOURS_ACTIVITY',
        severity: 'low',
        detected_at: now.toISOString(),
        details: { activity_count: offHoursActivity.count, hour_utc: currentHour },
        actors: [],
        acknowledged: false,
        acknowledged_by: null,
        acknowledged_at: null,
      });
    }
  }
  
  // Save new anomalies
  if (newAnomalies.length > 0) {
    const existing = loadAnomalies();
    saveAnomalies([...existing, ...newAnomalies]);
  }
  
  return newAnomalies;
}

export function listAnomalies(acknowledged?: boolean): AnomalyAlert[] {
  const anomalies = loadAnomalies();
  if (acknowledged !== undefined) {
    return anomalies.filter(a => a.acknowledged === acknowledged);
  }
  return anomalies;
}

export function acknowledgeAnomaly(alertId: string, acknowledgedBy: string): AnomalyAlert | null {
  const anomalies = loadAnomalies();
  const alert = anomalies.find(a => a.alert_id === alertId);
  
  if (!alert) return null;
  
  alert.acknowledged = true;
  alert.acknowledged_by = acknowledgedBy;
  alert.acknowledged_at = new Date().toISOString();
  
  saveAnomalies(anomalies);
  return alert;
}

// ========== Approver Rate Limits ==========

export function checkApproverRateLimit(userId: string): { allowed: boolean; current: number; max: number; blocked_until?: string } {
  const limits = loadRateLimits();
  const now = new Date();
  
  let userLimit = limits.find(l => l.user_id === userId);
  
  if (!userLimit) {
    userLimit = {
      user_id: userId,
      window_hours: APPROVAL_RATE_LIMIT_WINDOW_HOURS,
      max_approvals: APPROVAL_RATE_LIMIT_MAX,
      current_count: 0,
      window_start: now.toISOString(),
      blocked_until: null,
    };
    limits.push(userLimit);
  }
  
  // Check if window expired
  const windowStart = new Date(userLimit.window_start);
  const windowEnd = new Date(windowStart.getTime() + userLimit.window_hours * 60 * 60 * 1000);
  
  if (now > windowEnd) {
    // Reset window
    userLimit.current_count = 0;
    userLimit.window_start = now.toISOString();
    userLimit.blocked_until = null;
  }
  
  // Check if blocked
  if (userLimit.blocked_until && new Date(userLimit.blocked_until) > now) {
    saveRateLimits(limits);
    return {
      allowed: false,
      current: userLimit.current_count,
      max: userLimit.max_approvals,
      blocked_until: userLimit.blocked_until,
    };
  }
  
  // Check limit
  if (userLimit.current_count >= userLimit.max_approvals) {
    userLimit.blocked_until = windowEnd.toISOString();
    saveRateLimits(limits);
    return {
      allowed: false,
      current: userLimit.current_count,
      max: userLimit.max_approvals,
      blocked_until: userLimit.blocked_until,
    };
  }
  
  saveRateLimits(limits);
  return {
    allowed: true,
    current: userLimit.current_count,
    max: userLimit.max_approvals,
  };
}

export function recordApproval(userId: string): void {
  const limits = loadRateLimits();
  let userLimit = limits.find(l => l.user_id === userId);
  
  if (!userLimit) {
    userLimit = {
      user_id: userId,
      window_hours: APPROVAL_RATE_LIMIT_WINDOW_HOURS,
      max_approvals: APPROVAL_RATE_LIMIT_MAX,
      current_count: 0,
      window_start: new Date().toISOString(),
      blocked_until: null,
    };
    limits.push(userLimit);
  }
  
  userLimit.current_count++;
  saveRateLimits(limits);
}

export function getApproverStats(): Array<{
  user_id: string;
  current_count: number;
  max_approvals: number;
  window_start: string;
  blocked: boolean;
}> {
  const limits = loadRateLimits();
  return limits.map(l => ({
    user_id: l.user_id,
    current_count: l.current_count,
    max_approvals: l.max_approvals,
    window_start: l.window_start,
    blocked: l.blocked_until !== null && new Date(l.blocked_until) > new Date(),
  }));
}

// ========== Ledger Integration ==========

async function logGovernanceEvent(eventType: string, payload: Record<string, unknown>, actorId: string): Promise<string> {
  const db = await getDb();
  const tsUtc = new Date().toISOString();
  const payloadJson = canonicalJSON(payload);
  
  const last = (await dbGet(db, 'SELECT block_hash FROM ledger_events ORDER BY id DESC LIMIT 1')) as { block_hash: string } | undefined;
  const prevHash = last?.block_hash ?? null;
  
  const blockHash = computeEventHash({
    prev_hash: prevHash,
    event_type: eventType,
    ts_utc: tsUtc,
    actor_id: actorId,
    canonical_payload_json: payloadJson,
  });
  
  await dbRun(db, 'INSERT INTO ledger_events (event_type, payload_json, prev_hash, block_hash, created_at, actor_id) VALUES (?, ?, ?, ?, ?, ?)', eventType, payloadJson, prevHash, blockHash, tsUtc, actorId);
  
  return blockHash;
}
