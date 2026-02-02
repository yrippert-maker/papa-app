/**
 * External Auditor Pack Service
 * Generates comprehensive audit bundles for external auditors.
 */
import { createHash } from 'crypto';
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { WORKSPACE_ROOT } from './config';
import { listSnapshots, readSnapshot, type SignedSnapshot } from './audit-snapshot-service';
import { getKeysStatus, getKeyAuditEvents } from './compliance-service';
import { RETENTION_POLICY, computePolicyHash } from './retention-service';
import { getActiveKeyId } from './evidence-signing';
import { canonicalJSON } from './ledger-hash';
import { getDbReadOnly } from './db';

const AUDIT_PACKS_DIR = join(WORKSPACE_ROOT, '00_SYSTEM', 'audit-packs');
const KEYS_DIR = join(WORKSPACE_ROOT, '00_SYSTEM', 'keys');

// ========== Types ==========

export type LegalHoldStatus = 'none' | 'active' | 'released';

export type LegalHold = {
  hold_id: string;
  reason: string;
  custodian: string;
  start_date: string;
  end_date: string | null;
  status: LegalHoldStatus;
  scope: {
    from_date: string;
    to_date: string;
    includes_keys: boolean;
    includes_snapshots: boolean;
    includes_ledger: boolean;
  };
  created_by: string;
  created_at: string;
  released_by: string | null;
  released_at: string | null;
};

export type EvidenceIndexEntry = {
  period: { from: string; to: string };
  snapshot_id: string;
  snapshot_hash: string;
  signature: string;
  key_id: string;
  signed_at: string;
  filename: string;
};

export type EvidenceIndex = {
  index_version: string;
  generated_at: string;
  period_covered: { from: string; to: string };
  entry_count: number;
  entries: EvidenceIndexEntry[];
  index_hash: string;
};

export type AuditPackManifest = {
  pack_version: string;
  pack_id: string;
  generated_at: string;
  generated_by: string;
  period: { from: string; to: string };
  contents: {
    snapshots: string[];
    evidence_index: string;
    retention_policy: string;
    verification_instructions: string;
    keys_inventory: string;
    legal_holds: string;
  };
  checksums: Record<string, string>;
  pack_hash: string;
};

// ========== Legal Holds (in-memory + file-based for persistence) ==========

const LEGAL_HOLDS_FILE = join(WORKSPACE_ROOT, '00_SYSTEM', 'legal-holds.json');

function loadLegalHolds(): LegalHold[] {
  if (!existsSync(LEGAL_HOLDS_FILE)) return [];
  try {
    return JSON.parse(readFileSync(LEGAL_HOLDS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function saveLegalHolds(holds: LegalHold[]): void {
  const dir = join(WORKSPACE_ROOT, '00_SYSTEM');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(LEGAL_HOLDS_FILE, JSON.stringify(holds, null, 2), 'utf8');
}

export function createLegalHold(input: {
  reason: string;
  custodian: string;
  scope: LegalHold['scope'];
  created_by: string;
}): LegalHold {
  const holds = loadLegalHolds();
  
  const hold: LegalHold = {
    hold_id: crypto.randomUUID(),
    reason: input.reason,
    custodian: input.custodian,
    start_date: new Date().toISOString(),
    end_date: null,
    status: 'active',
    scope: input.scope,
    created_by: input.created_by,
    created_at: new Date().toISOString(),
    released_by: null,
    released_at: null,
  };
  
  holds.push(hold);
  saveLegalHolds(holds);
  
  return hold;
}

export function releaseLegalHold(holdId: string, releasedBy: string): LegalHold | null {
  const holds = loadLegalHolds();
  const hold = holds.find(h => h.hold_id === holdId);
  
  if (!hold) return null;
  if (hold.status !== 'active') return null;
  
  hold.status = 'released';
  hold.end_date = new Date().toISOString();
  hold.released_by = releasedBy;
  hold.released_at = new Date().toISOString();
  
  saveLegalHolds(holds);
  return hold;
}

export function listLegalHolds(status?: LegalHoldStatus): LegalHold[] {
  const holds = loadLegalHolds();
  if (status) return holds.filter(h => h.status === status);
  return holds;
}

export function isUnderLegalHold(date: string): boolean {
  const holds = loadLegalHolds().filter(h => h.status === 'active');
  const d = new Date(date);
  
  return holds.some(h => {
    const from = new Date(h.scope.from_date);
    const to = new Date(h.scope.to_date);
    return d >= from && d <= to;
  });
}

// ========== Evidence Index ==========

export function generateEvidenceIndex(fromDate?: string, toDate?: string): EvidenceIndex {
  const snapshots = listSnapshots();
  const entries: EvidenceIndexEntry[] = [];
  
  let minDate = fromDate ?? '2020-01-01';
  let maxDate = toDate ?? new Date().toISOString();
  
  for (const s of snapshots) {
    const snapshot = readSnapshot(s.filename);
    if (!snapshot) continue;
    
    // Filter by date range
    if (snapshot.snapshot.period.from < minDate) continue;
    if (snapshot.snapshot.period.to > maxDate) continue;
    
    entries.push({
      period: snapshot.snapshot.period,
      snapshot_id: snapshot.snapshot.snapshot_id,
      snapshot_hash: snapshot.snapshot.snapshot_hash,
      signature: snapshot.signature,
      key_id: snapshot.key_id,
      signed_at: snapshot.signed_at,
      filename: s.filename,
    });
  }
  
  // Sort by period
  entries.sort((a, b) => a.period.from.localeCompare(b.period.from));
  
  const periodCovered = entries.length > 0 ? {
    from: entries[0].period.from,
    to: entries[entries.length - 1].period.to,
  } : { from: minDate, to: maxDate };
  
  const indexBase = {
    index_version: '1.0.0',
    generated_at: new Date().toISOString(),
    period_covered: periodCovered,
    entry_count: entries.length,
    entries,
  };
  
  const indexHash = createHash('sha256')
    .update(canonicalJSON(indexBase as Record<string, unknown>))
    .digest('hex');
  
  return { ...indexBase, index_hash: indexHash };
}

// ========== Verification Instructions ==========

export function generateVerificationInstructions(): string {
  return `# Evidence Verification Instructions

## Overview

This document provides step-by-step instructions for verifying the integrity and 
authenticity of audit evidence in this pack.

## Prerequisites

- Node.js 18+ or OpenSSL CLI
- Access to verification scripts (included in pack)

## Verification Steps

### 1. Verify Evidence Index Integrity

\`\`\`bash
# Compute index hash (excluding index_hash field)
node -e "
const fs = require('fs');
const crypto = require('crypto');
const idx = JSON.parse(fs.readFileSync('evidence-index.json'));
delete idx.index_hash;
const hash = crypto.createHash('sha256')
  .update(JSON.stringify(idx, Object.keys(idx).sort()))
  .digest('hex');
console.log('Computed:', hash);
console.log('Expected:', JSON.parse(fs.readFileSync('evidence-index.json')).index_hash);
"
\`\`\`

### 2. Verify Individual Snapshot Signatures

For each snapshot in the pack:

\`\`\`bash
# Using OpenSSL
openssl dgst -sha256 -verify keys/<key_id>/evidence-signing.pub \\
  -signature <(echo -n "<signature_hex>" | xxd -r -p) \\
  <(echo -n "<snapshot_hash>")

# Using Node.js
node -e "
const crypto = require('crypto');
const fs = require('fs');
const pubKey = fs.readFileSync('keys/<key_id>/evidence-signing.pub');
const hash = '<snapshot_hash>';
const sig = Buffer.from('<signature_hex>', 'hex');
const verify = crypto.createVerify('SHA256');
verify.update(hash);
console.log('Valid:', verify.verify(pubKey, sig));
"
\`\`\`

### 3. Verify Hash Chain Continuity

Check that each snapshot's \`previous_snapshot_hash\` matches the preceding 
snapshot's \`snapshot_hash\`:

\`\`\`bash
node verify-chain.js snapshots/
\`\`\`

### 4. Verify Key Inventory

Compare the included public keys against:
- Expected key IDs from evidence index
- Organization's key rotation records

### 5. Cross-Reference with Legal Holds

If legal holds are present, verify:
- Hold dates match evidence coverage
- No evidence from hold period has been deleted

## Troubleshooting

| Error | Cause | Resolution |
|-------|-------|------------|
| Signature invalid | Key mismatch | Check key_id matches |
| Chain broken | Missing snapshot | Request complete set |
| Hash mismatch | File corrupted | Request fresh copy |

## Contact

For questions, contact: compliance@organization.com
`;
}

// ========== Keys Inventory ==========

export function generateKeysInventory(): {
  generated_at: string;
  active_key: { key_id: string; created_at: string | null } | null;
  archived_keys: Array<{ key_id: string; status: string; created_at: string | null }>;
  total_keys: number;
} {
  const status = getKeysStatus();
  
  return {
    generated_at: new Date().toISOString(),
    active_key: status.active ? {
      key_id: status.active.key_id,
      created_at: status.active.created_at ?? null,
    } : null,
    archived_keys: status.archived.map(k => ({
      key_id: k.key_id,
      status: k.status,
      created_at: k.created_at ?? null,
    })),
    total_keys: (status.active ? 1 : 0) + status.archived.length,
  };
}

// ========== Audit Pack Generation ==========

export function generateAuditPack(options: {
  from_date: string;
  to_date: string;
  include_keys: boolean;
  generated_by: string;
}): { pack_path: string; manifest: AuditPackManifest } {
  const packId = crypto.randomUUID();
  const packDir = join(AUDIT_PACKS_DIR, `audit-pack-${packId.slice(0, 8)}`);
  
  if (!existsSync(packDir)) mkdirSync(packDir, { recursive: true });
  
  const checksums: Record<string, string> = {};
  const snapshotFiles: string[] = [];
  
  // 1. Copy snapshots
  const snapshotsDir = join(packDir, 'snapshots');
  mkdirSync(snapshotsDir, { recursive: true });
  
  const snapshots = listSnapshots();
  for (const s of snapshots) {
    const snapshot = readSnapshot(s.filename);
    if (!snapshot) continue;
    
    if (snapshot.snapshot.period.from < options.from_date) continue;
    if (snapshot.snapshot.period.to > options.to_date) continue;
    
    const targetPath = join(snapshotsDir, s.filename);
    const content = JSON.stringify(snapshot, null, 2);
    writeFileSync(targetPath, content, 'utf8');
    
    checksums[`snapshots/${s.filename}`] = createHash('sha256').update(content).digest('hex');
    snapshotFiles.push(`snapshots/${s.filename}`);
  }
  
  // 2. Generate evidence index
  const evidenceIndex = generateEvidenceIndex(options.from_date, options.to_date);
  const indexContent = JSON.stringify(evidenceIndex, null, 2);
  writeFileSync(join(packDir, 'evidence-index.json'), indexContent, 'utf8');
  checksums['evidence-index.json'] = createHash('sha256').update(indexContent).digest('hex');
  
  // 3. Include retention policy
  const retentionContent = JSON.stringify({
    policy: RETENTION_POLICY,
    policy_hash: computePolicyHash(RETENTION_POLICY),
    exported_at: new Date().toISOString(),
  }, null, 2);
  writeFileSync(join(packDir, 'retention-policy.json'), retentionContent, 'utf8');
  checksums['retention-policy.json'] = createHash('sha256').update(retentionContent).digest('hex');
  
  // 4. Generate verification instructions
  const instructions = generateVerificationInstructions();
  writeFileSync(join(packDir, 'VERIFICATION_INSTRUCTIONS.md'), instructions, 'utf8');
  checksums['VERIFICATION_INSTRUCTIONS.md'] = createHash('sha256').update(instructions).digest('hex');
  
  // 5. Keys inventory
  const keysInventory = generateKeysInventory();
  const keysContent = JSON.stringify(keysInventory, null, 2);
  writeFileSync(join(packDir, 'keys-inventory.json'), keysContent, 'utf8');
  checksums['keys-inventory.json'] = createHash('sha256').update(keysContent).digest('hex');
  
  // 6. Copy public keys if requested
  if (options.include_keys) {
    const keysDir = join(packDir, 'keys');
    mkdirSync(keysDir, { recursive: true });
    
    // Active key
    const activeKeyId = getActiveKeyId();
    if (activeKeyId && existsSync(join(KEYS_DIR, 'active', 'evidence-signing.pub'))) {
      const activeDir = join(keysDir, activeKeyId);
      mkdirSync(activeDir, { recursive: true });
      const pubContent = readFileSync(join(KEYS_DIR, 'active', 'evidence-signing.pub'), 'utf8');
      writeFileSync(join(activeDir, 'evidence-signing.pub'), pubContent, 'utf8');
      checksums[`keys/${activeKeyId}/evidence-signing.pub`] = createHash('sha256').update(pubContent).digest('hex');
    }
    
    // Archived keys
    const archivedDir = join(KEYS_DIR, 'archived');
    if (existsSync(archivedDir)) {
      const keyDirs = readdirSync(archivedDir).filter(d => statSync(join(archivedDir, d)).isDirectory());
      for (const keyId of keyDirs) {
        const pubFile = join(archivedDir, keyId, 'evidence-signing.pub');
        if (existsSync(pubFile)) {
          const targetDir = join(keysDir, keyId);
          mkdirSync(targetDir, { recursive: true });
          const pubContent = readFileSync(pubFile, 'utf8');
          writeFileSync(join(targetDir, 'evidence-signing.pub'), pubContent, 'utf8');
          checksums[`keys/${keyId}/evidence-signing.pub`] = createHash('sha256').update(pubContent).digest('hex');
        }
      }
    }
  }
  
  // 7. Legal holds
  const legalHolds = listLegalHolds();
  const holdsContent = JSON.stringify({
    exported_at: new Date().toISOString(),
    active_holds: legalHolds.filter(h => h.status === 'active'),
    released_holds: legalHolds.filter(h => h.status === 'released'),
    total_holds: legalHolds.length,
  }, null, 2);
  writeFileSync(join(packDir, 'legal-holds.json'), holdsContent, 'utf8');
  checksums['legal-holds.json'] = createHash('sha256').update(holdsContent).digest('hex');
  
  // 8. Generate manifest
  const manifestBase: Omit<AuditPackManifest, 'pack_hash'> = {
    pack_version: '1.0.0',
    pack_id: packId,
    generated_at: new Date().toISOString(),
    generated_by: options.generated_by,
    period: { from: options.from_date, to: options.to_date },
    contents: {
      snapshots: snapshotFiles,
      evidence_index: 'evidence-index.json',
      retention_policy: 'retention-policy.json',
      verification_instructions: 'VERIFICATION_INSTRUCTIONS.md',
      keys_inventory: 'keys-inventory.json',
      legal_holds: 'legal-holds.json',
    },
    checksums,
  };
  
  const packHash = createHash('sha256')
    .update(canonicalJSON(manifestBase as Record<string, unknown>))
    .digest('hex');
  
  const manifest: AuditPackManifest = { ...manifestBase, pack_hash: packHash };
  
  writeFileSync(join(packDir, 'MANIFEST.json'), JSON.stringify(manifest, null, 2), 'utf8');
  
  // 9. Create ZIP
  const zipPath = `${packDir}.zip`;
  try {
    execSync(`cd "${AUDIT_PACKS_DIR}" && zip -r "${packDir}.zip" "audit-pack-${packId.slice(0, 8)}"`, { stdio: 'pipe' });
  } catch {
    // ZIP creation optional
  }
  
  return { pack_path: existsSync(zipPath) ? zipPath : packDir, manifest };
}

export function listAuditPacks(): Array<{ pack_id: string; path: string; created_at: string }> {
  if (!existsSync(AUDIT_PACKS_DIR)) return [];
  
  const items = readdirSync(AUDIT_PACKS_DIR);
  const packs: Array<{ pack_id: string; path: string; created_at: string }> = [];
  
  for (const item of items) {
    const fullPath = join(AUDIT_PACKS_DIR, item);
    const stat = statSync(fullPath);
    
    if (item.startsWith('audit-pack-')) {
      const packId = item.replace('audit-pack-', '').replace('.zip', '');
      packs.push({
        pack_id: packId,
        path: fullPath,
        created_at: stat.mtime.toISOString(),
      });
    }
  }
  
  return packs.sort((a, b) => b.created_at.localeCompare(a.created_at));
}
