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
