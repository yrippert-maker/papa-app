/**
 * Compliance service — key management and verification statistics.
 * Uses evidence-signing for key operations, metrics modules for stats.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { WORKSPACE_ROOT } from './config';
import {
  listKeyIds,
  getKeyStatus,
  rotateKeys as rotateKeysInternal,
  revokeKey as revokeKeyInternal,
  getActiveKeyId,
  type KeyStatus,
} from './evidence-signing';
import { getEvidenceVerifyMetrics } from './metrics/evidence-verify';
import { getDeadLetterMetrics } from './metrics/dead-letter';
import { getDbReadOnly, getDb } from './db';
import { computeEventHash, canonicalJSON } from './ledger-hash';

const KEYS_DIR = join(WORKSPACE_ROOT, '00_SYSTEM', 'keys');
const ACTIVE_DIR = join(KEYS_DIR, 'active');
const ARCHIVED_DIR = join(KEYS_DIR, 'archived');

export type KeyInfo = {
  key_id: string;
  status: 'active' | 'archived' | 'revoked';
  created_at?: string;
  archived_at?: string;
  revoked_at?: string;
  revocation_reason?: string;
};

export type KeysResponse = {
  active: KeyInfo | null;
  archived: KeyInfo[];
};

export type VerifyStatsResponse = {
  total: number;
  ok: number;
  errors: {
    content_invalid: number;
    key_revoked: number;
    key_not_found: number;
    signature_invalid: number;
    other_error: number;
  };
  rate_limited: number;
  unauthorized: number;
};

export type DeadLetterStatsResponse = {
  events_total: number;
  replay: {
    dry_run_ok: number;
    dry_run_failed: number;
    live_ok: number;
    live_failed: number;
  };
};

/**
 * Gets list of all keys with their status.
 */
export function getKeysStatus(): KeysResponse {
  const { active, archived } = listKeyIds();
  
  let activeInfo: KeyInfo | null = null;
  if (active) {
    // Try to get created_at from key_id.txt mtime
    let createdAt: string | undefined;
    const keyIdFile = join(ACTIVE_DIR, 'key_id.txt');
    if (existsSync(keyIdFile)) {
      try {
        const { mtime } = require('fs').statSync(keyIdFile);
        createdAt = mtime.toISOString();
      } catch {
        // ignore
      }
    }
    activeInfo = {
      key_id: active,
      status: 'active',
      created_at: createdAt,
    };
  }
  
  const archivedList: KeyInfo[] = [];
  for (const keyId of archived) {
    const status = getKeyStatus(keyId);
    if (!status) continue;
    
    let archivedAt: string | undefined;
    const archivedAtFile = join(ARCHIVED_DIR, keyId, 'archived_at.txt');
    if (existsSync(archivedAtFile)) {
      try {
        archivedAt = readFileSync(archivedAtFile, 'utf8').trim();
      } catch {
        // ignore
      }
    }
    
    const info: KeyInfo = {
      key_id: keyId,
      status: status.isRevoked ? 'revoked' : 'archived',
      archived_at: archivedAt,
    };
    
    if (status.isRevoked && status.revocationInfo) {
      info.revoked_at = status.revocationInfo.revokedAt;
      info.revocation_reason = status.revocationInfo.reason;
    }
    
    archivedList.push(info);
  }
  
  // Sort archived by archived_at descending (most recent first)
  archivedList.sort((a, b) => {
    const aTime = a.archived_at ? new Date(a.archived_at).getTime() : 0;
    const bTime = b.archived_at ? new Date(b.archived_at).getTime() : 0;
    return bTime - aTime;
  });
  
  return { active: activeInfo, archived: archivedList };
}

/**
 * Rotates keys: archives current and creates new.
 */
export function rotateKeys(): KeyInfo {
  const result = rotateKeysInternal();
  return {
    key_id: result.keyId,
    status: 'active',
    created_at: new Date().toISOString(),
  };
}

/**
 * Revokes an archived key.
 */
export function revokeKey(keyId: string, reason: string): boolean {
  return revokeKeyInternal(keyId, reason);
}

/**
 * Gets verify statistics from metrics.
 */
export function getVerifyStats(): VerifyStatsResponse {
  const metrics = getEvidenceVerifyMetrics();
  const total = Object.values(metrics).reduce((sum, v) => sum + v, 0);
  
  return {
    total,
    ok: metrics.ok,
    errors: {
      content_invalid: metrics.content_invalid,
      key_revoked: metrics.key_revoked,
      key_not_found: metrics.key_not_found,
      signature_invalid: metrics.signature_invalid,
      other_error: metrics.other_error,
    },
    rate_limited: metrics.rate_limited,
    unauthorized: metrics.unauthorized,
  };
}

/**
 * Gets dead-letter statistics from metrics.
 */
export function getDeadLetterStats(): DeadLetterStatsResponse {
  const metrics = getDeadLetterMetrics();
  
  return {
    events_total: metrics.events_total,
    replay: {
      dry_run_ok: metrics.replay_dry_run_ok,
      dry_run_failed: metrics.replay_dry_run_failed,
      live_ok: metrics.replay_live_ok,
      live_failed: metrics.replay_live_failed,
    },
  };
}

// ========== Key Audit Logging ==========

export type KeyAuditEvent = {
  id: number;
  event_type: string;
  action: 'KEY_ROTATED' | 'KEY_REVOKED';
  key_id: string;
  new_key_id?: string;
  reason?: string;
  actor_id: string | null;
  created_at: string;
  block_hash: string;
};

/**
 * Logs a key action to the ledger.
 */
export function logKeyAction(
  action: 'KEY_ROTATED' | 'KEY_REVOKED',
  payload: { key_id: string; new_key_id?: string; reason?: string },
  actorId: string | null
): string {
  const db = getDb();
  const tsUtc = new Date().toISOString();
  const eventType = `COMPLIANCE_${action}`;
  const payloadJson = canonicalJSON(payload as Record<string, unknown>);
  
  const last = db.prepare('SELECT block_hash FROM ledger_events ORDER BY id DESC LIMIT 1').get() as { block_hash: string } | undefined;
  const prevHash = last?.block_hash ?? null;
  
  const blockHash = computeEventHash({
    prev_hash: prevHash,
    event_type: eventType,
    ts_utc: tsUtc,
    actor_id: actorId ?? '',
    canonical_payload_json: payloadJson,
  });
  
  db.prepare(
    'INSERT INTO ledger_events (event_type, payload_json, prev_hash, block_hash, created_at, actor_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(eventType, payloadJson, prevHash, blockHash, tsUtc, actorId);
  
  return blockHash;
}

/**
 * Gets key audit events from ledger.
 */
export function getKeyAuditEvents(limit = 50): KeyAuditEvent[] {
  const db = getDbReadOnly();
  const rows = db.prepare(`
    SELECT id, event_type, payload_json, actor_id, created_at, block_hash
    FROM ledger_events
    WHERE event_type LIKE 'COMPLIANCE_KEY_%'
    ORDER BY id DESC
    LIMIT ?
  `).all(limit) as Array<{
    id: number;
    event_type: string;
    payload_json: string;
    actor_id: string | null;
    created_at: string;
    block_hash: string;
  }>;
  
  return rows.map((row) => {
    const payload = JSON.parse(row.payload_json);
    const action = row.event_type.replace('COMPLIANCE_', '') as 'KEY_ROTATED' | 'KEY_REVOKED';
    return {
      id: row.id,
      event_type: row.event_type,
      action,
      key_id: payload.key_id,
      new_key_id: payload.new_key_id,
      reason: payload.reason,
      actor_id: row.actor_id,
      created_at: row.created_at,
      block_hash: row.block_hash,
    };
  });
}

// ========== CSV Export ==========

/**
 * Generates CSV string for verify statistics.
 */
export function getVerifyStatsCSV(): string {
  const stats = getVerifyStats();
  const deadLetter = getDeadLetterStats();
  const timestamp = new Date().toISOString();
  
  const lines: string[] = [
    'metric,value,timestamp',
    `total_requests,${stats.total},${timestamp}`,
    `ok,${stats.ok},${timestamp}`,
    `error_content_invalid,${stats.errors.content_invalid},${timestamp}`,
    `error_key_revoked,${stats.errors.key_revoked},${timestamp}`,
    `error_key_not_found,${stats.errors.key_not_found},${timestamp}`,
    `error_signature_invalid,${stats.errors.signature_invalid},${timestamp}`,
    `error_other,${stats.errors.other_error},${timestamp}`,
    `rate_limited,${stats.rate_limited},${timestamp}`,
    `unauthorized,${stats.unauthorized},${timestamp}`,
    `dead_letter_events,${deadLetter.events_total},${timestamp}`,
    `replay_dry_run_ok,${deadLetter.replay.dry_run_ok},${timestamp}`,
    `replay_dry_run_failed,${deadLetter.replay.dry_run_failed},${timestamp}`,
    `replay_live_ok,${deadLetter.replay.live_ok},${timestamp}`,
    `replay_live_failed,${deadLetter.replay.live_failed},${timestamp}`,
  ];
  
  return lines.join('\n');
}

/**
 * Generates CSV string for key audit events.
 */
export function getKeyAuditCSV(): string {
  const events = getKeyAuditEvents(1000);
  
  const lines: string[] = [
    'timestamp,action,key_id,new_key_id,reason,actor_id,block_hash',
  ];
  
  for (const e of events) {
    const reason = e.reason ? `"${e.reason.replace(/"/g, '""')}"` : '';
    lines.push(
      `${e.created_at},${e.action},${e.key_id},${e.new_key_id ?? ''},${reason},${e.actor_id ?? ''},${e.block_hash}`
    );
  }
  
  return lines.join('\n');
}
