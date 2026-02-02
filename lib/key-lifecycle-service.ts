/**
 * Key Lifecycle Service — 2-man rule approval flow for rotate/revoke.
 * 
 * Workflow:
 * 1. Initiator creates request (PENDING)
 * 2. Different user approves (APPROVED) or rejects (REJECTED)
 * 3. Initiator or approver executes (EXECUTED)
 * 4. Timeout moves to EXPIRED
 */
import { getDb, getDbReadOnly } from './db';
import { computeEventHash, canonicalJSON } from './ledger-hash';
import crypto from 'crypto';

// Timeouts
const APPROVAL_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24h for approval
const EXECUTION_TIMEOUT_MS = 1 * 60 * 60 * 1000;  // 1h for execution after approval
const BREAK_GLASS_DURATION_MS = 4 * 60 * 60 * 1000; // 4h break-glass window

export type RequestAction = 'ROTATE' | 'REVOKE';

// Break-glass state type
export type BreakGlassStateData = {
  active: boolean;
  activated_by: string;
  activated_at: string;
  expires_at: string;
  reason: string;
  actions_taken: Array<{ action: string; timestamp: string; details: string }>;
};

// Break-glass state (in-memory for simplicity; in production use DB)
let breakGlassState: BreakGlassStateData | null = null;
export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'EXECUTED';

export type KeyLifecycleRequest = {
  id: string;
  action: RequestAction;
  target_key_id: string | null;
  reason: string | null;
  status: RequestStatus;
  initiator_id: string;
  initiator_signature: string | null;
  approver_id: string | null;
  approver_signature: string | null;
  rejection_reason: string | null;
  created_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  executed_at: string | null;
  expires_at: string;
  execution_result: string | null;
  ledger_block_hash: string | null;
};

export type CreateRequestInput = {
  action: RequestAction;
  target_key_id?: string;
  reason?: string;
  initiator_id: string;
};

export type ApproveInput = {
  request_id: string;
  approver_id: string;
};

export type RejectInput = {
  request_id: string;
  rejector_id: string;
  reason?: string;
};

export type ExecuteInput = {
  request_id: string;
  executor_id: string;
};

/**
 * Generates a unique request ID.
 */
function generateRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Computes signature for intent/approval (simplified - uses HMAC for demo).
 * In production, use actual Ed25519 signatures with user keys.
 */
function computeSignature(payload: Record<string, unknown>, secret: string): string {
  const canonical = canonicalJSON(payload);
  return crypto.createHmac('sha256', secret).update(canonical).digest('hex').slice(0, 32);
}

/**
 * Creates a new key lifecycle request.
 */
export function createRequest(input: CreateRequestInput): KeyLifecycleRequest {
  const db = getDb();
  const id = generateRequestId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + APPROVAL_TIMEOUT_MS);
  
  // Validate action
  if (input.action === 'REVOKE' && !input.target_key_id) {
    throw new Error('target_key_id required for REVOKE action');
  }
  
  // Create intent payload for signing
  const intentPayload = {
    request_id: id,
    action: input.action,
    target_key_id: input.target_key_id ?? null,
    reason: input.reason ?? null,
    initiator_id: input.initiator_id,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  };
  
  // Sign intent (in production, use user's private key)
  const signature = computeSignature(intentPayload, `intent-${input.initiator_id}`);
  
  db.prepare(`
    INSERT INTO key_lifecycle_requests 
    (id, action, target_key_id, reason, status, initiator_id, initiator_signature, created_at, expires_at)
    VALUES (?, ?, ?, ?, 'PENDING', ?, ?, ?, ?)
  `).run(
    id,
    input.action,
    input.target_key_id ?? null,
    input.reason ?? null,
    input.initiator_id,
    signature,
    now.toISOString(),
    expiresAt.toISOString()
  );
  
  // Log to ledger
  logToLedger('KEY_REQUEST_CREATED', {
    request_id: id,
    action: input.action,
    target_key_id: input.target_key_id ?? null,
    reason: input.reason ?? null,
  }, input.initiator_id);
  
  return getRequest(id)!;
}

/**
 * Approves a pending request (must be different user).
 */
export function approveRequest(input: ApproveInput): KeyLifecycleRequest {
  const db = getDb();
  const request = getRequest(input.request_id);
  
  if (!request) {
    throw new Error('Request not found');
  }
  
  if (request.status !== 'PENDING') {
    throw new Error(`Cannot approve request with status: ${request.status}`);
  }
  
  if (request.initiator_id === input.approver_id) {
    throw new Error('Approver must be different from initiator (2-man rule)');
  }
  
  // Check expiration
  if (new Date(request.expires_at) < new Date()) {
    expireRequest(request.id);
    throw new Error('Request has expired');
  }
  
  const now = new Date();
  const newExpiresAt = new Date(now.getTime() + EXECUTION_TIMEOUT_MS);
  
  // Create approval payload for signing
  const approvalPayload = {
    request_id: input.request_id,
    action: 'APPROVE',
    approver_id: input.approver_id,
    approved_at: now.toISOString(),
  };
  
  const signature = computeSignature(approvalPayload, `approval-${input.approver_id}`);
  
  db.prepare(`
    UPDATE key_lifecycle_requests 
    SET status = 'APPROVED', 
        approver_id = ?, 
        approver_signature = ?,
        approved_at = ?,
        expires_at = ?
    WHERE id = ?
  `).run(
    input.approver_id,
    signature,
    now.toISOString(),
    newExpiresAt.toISOString(),
    input.request_id
  );
  
  // Log to ledger
  logToLedger('KEY_REQUEST_APPROVED', {
    request_id: input.request_id,
    approver_id: input.approver_id,
  }, input.approver_id);
  
  return getRequest(input.request_id)!;
}

/**
 * Rejects a pending request.
 */
export function rejectRequest(input: RejectInput): KeyLifecycleRequest {
  const db = getDb();
  const request = getRequest(input.request_id);
  
  if (!request) {
    throw new Error('Request not found');
  }
  
  if (request.status !== 'PENDING') {
    throw new Error(`Cannot reject request with status: ${request.status}`);
  }
  
  const now = new Date();
  
  db.prepare(`
    UPDATE key_lifecycle_requests 
    SET status = 'REJECTED',
        rejection_reason = ?,
        rejected_at = ?
    WHERE id = ?
  `).run(
    input.reason ?? 'Rejected by reviewer',
    now.toISOString(),
    input.request_id
  );
  
  // Log to ledger
  logToLedger('KEY_REQUEST_REJECTED', {
    request_id: input.request_id,
    rejector_id: input.rejector_id,
    reason: input.reason ?? null,
  }, input.rejector_id);
  
  return getRequest(input.request_id)!;
}

/**
 * Marks a request as executed.
 */
export function markExecuted(requestId: string, executorId: string, result: string): KeyLifecycleRequest {
  const db = getDb();
  const request = getRequest(requestId);
  
  if (!request) {
    throw new Error('Request not found');
  }
  
  if (request.status !== 'APPROVED') {
    throw new Error(`Cannot execute request with status: ${request.status}`);
  }
  
  // Check expiration
  if (new Date(request.expires_at) < new Date()) {
    expireRequest(request.id);
    throw new Error('Approval has expired');
  }
  
  const now = new Date();
  
  db.prepare(`
    UPDATE key_lifecycle_requests 
    SET status = 'EXECUTED',
        executed_at = ?,
        execution_result = ?
    WHERE id = ?
  `).run(
    now.toISOString(),
    result,
    requestId
  );
  
  // Log to ledger
  logToLedger('KEY_REQUEST_EXECUTED', {
    request_id: requestId,
    executor_id: executorId,
    action: request.action,
    target_key_id: request.target_key_id,
  }, executorId);
  
  return getRequest(requestId)!;
}

/**
 * Expires a request.
 */
function expireRequest(requestId: string): void {
  const db = getDb();
  db.prepare(`
    UPDATE key_lifecycle_requests 
    SET status = 'EXPIRED'
    WHERE id = ? AND status IN ('PENDING', 'APPROVED')
  `).run(requestId);
}

/**
 * Expires all timed-out requests.
 */
export function expireTimedOutRequests(): number {
  const db = getDb();
  const now = new Date().toISOString();
  
  const result = db.prepare(`
    UPDATE key_lifecycle_requests 
    SET status = 'EXPIRED'
    WHERE status IN ('PENDING', 'APPROVED') AND expires_at < ?
  `).run(now);
  
  return result.changes;
}

/**
 * Gets a request by ID.
 */
export function getRequest(id: string): KeyLifecycleRequest | null {
  const db = getDbReadOnly();
  const row = db.prepare('SELECT * FROM key_lifecycle_requests WHERE id = ?').get(id) as KeyLifecycleRequest | undefined;
  return row ?? null;
}

/**
 * Lists requests with optional filters.
 */
export function listRequests(options: {
  status?: RequestStatus | RequestStatus[];
  initiator_id?: string;
  limit?: number;
} = {}): KeyLifecycleRequest[] {
  const db = getDbReadOnly();
  let query = 'SELECT * FROM key_lifecycle_requests WHERE 1=1';
  const params: (string | number)[] = [];
  
  if (options.status) {
    if (Array.isArray(options.status)) {
      query += ` AND status IN (${options.status.map(() => '?').join(', ')})`;
      params.push(...options.status);
    } else {
      query += ' AND status = ?';
      params.push(options.status);
    }
  }
  
  if (options.initiator_id) {
    query += ' AND initiator_id = ?';
    params.push(options.initiator_id);
  }
  
  query += ' ORDER BY created_at DESC';
  
  if (options.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
  }
  
  return db.prepare(query).all(...params) as KeyLifecycleRequest[];
}

/**
 * Gets pending requests count.
 */
export function getPendingCount(): number {
  const db = getDbReadOnly();
  const row = db.prepare("SELECT COUNT(*) as count FROM key_lifecycle_requests WHERE status = 'PENDING'").get() as { count: number };
  return row.count;
}

/**
 * Finds an approved request for an action.
 */
export function findApprovedRequest(action: RequestAction, targetKeyId?: string): KeyLifecycleRequest | null {
  const db = getDbReadOnly();
  let query = "SELECT * FROM key_lifecycle_requests WHERE action = ? AND status = 'APPROVED'";
  const params: string[] = [action];
  
  if (targetKeyId) {
    query += ' AND target_key_id = ?';
    params.push(targetKeyId);
  }
  
  query += ' ORDER BY approved_at DESC LIMIT 1';
  
  const row = db.prepare(query).get(...params) as KeyLifecycleRequest | undefined;
  return row ?? null;
}

/**
 * Logs key lifecycle event to ledger.
 */
function logToLedger(eventType: string, payload: Record<string, unknown>, actorId: string): string {
  const db = getDb();
  const tsUtc = new Date().toISOString();
  const payloadJson = canonicalJSON(payload);
  
  const last = db.prepare('SELECT block_hash FROM ledger_events ORDER BY id DESC LIMIT 1').get() as { block_hash: string } | undefined;
  const prevHash = last?.block_hash ?? null;
  
  const blockHash = computeEventHash({
    prev_hash: prevHash,
    event_type: eventType,
    ts_utc: tsUtc,
    actor_id: actorId,
    canonical_payload_json: payloadJson,
  });
  
  db.prepare(
    'INSERT INTO ledger_events (event_type, payload_json, prev_hash, block_hash, created_at, actor_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(eventType, payloadJson, prevHash, blockHash, tsUtc, actorId);
  
  return blockHash;
}

// ========== Break-Glass Emergency Override ==========

export type BreakGlassState = BreakGlassStateData | null;

/**
 * Activates break-glass mode.
 * Allows bypassing 2-man rule for emergency key operations.
 * Auto-expires after 4 hours.
 */
export function activateBreakGlass(activatorId: string, reason: string): BreakGlassState {
  if (breakGlassState?.active) {
    const expiresAt = new Date(breakGlassState.expires_at);
    if (expiresAt > new Date()) {
      throw new Error('Break-glass already active');
    }
  }
  
  const now = new Date();
  const expiresAt = new Date(now.getTime() + BREAK_GLASS_DURATION_MS);
  
  breakGlassState = {
    active: true,
    activated_by: activatorId,
    activated_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    reason,
    actions_taken: [],
  };
  
  // Log to ledger with elevated visibility
  logToLedger('BREAK_GLASS_ACTIVATED', {
    activated_by: activatorId,
    reason,
    expires_at: expiresAt.toISOString(),
    duration_hours: BREAK_GLASS_DURATION_MS / (60 * 60 * 1000),
  }, activatorId);
  
  return breakGlassState;
}

/**
 * Deactivates break-glass mode manually.
 */
export function deactivateBreakGlass(deactivatorId: string, reason?: string): void {
  if (!breakGlassState?.active) {
    throw new Error('Break-glass not active');
  }
  
  // Log deactivation
  logToLedger('BREAK_GLASS_DEACTIVATED', {
    deactivated_by: deactivatorId,
    reason: reason ?? 'Manual deactivation',
    actions_taken: breakGlassState.actions_taken.length,
    was_expired: new Date(breakGlassState.expires_at) < new Date(),
  }, deactivatorId);
  
  breakGlassState = null;
}

/**
 * Checks if break-glass is currently active.
 */
export function isBreakGlassActive(): boolean {
  if (!breakGlassState?.active) return false;
  
  const expiresAt = new Date(breakGlassState.expires_at);
  if (expiresAt < new Date()) {
    // Auto-expired, log it
    logToLedger('BREAK_GLASS_EXPIRED', {
      activated_by: breakGlassState.activated_by,
      actions_taken: breakGlassState.actions_taken.length,
    }, 'system');
    breakGlassState = null;
    return false;
  }
  
  return true;
}

/**
 * Gets current break-glass state.
 */
export function getBreakGlassState(): BreakGlassState {
  if (!isBreakGlassActive()) return null;
  return breakGlassState;
}

/**
 * Records an action taken during break-glass.
 */
export function recordBreakGlassAction(action: string, details: string): void {
  if (!breakGlassState?.active) return;
  
  breakGlassState.actions_taken.push({
    action,
    timestamp: new Date().toISOString(),
    details,
  });
}
