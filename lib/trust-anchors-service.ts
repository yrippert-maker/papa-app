/**
 * Trust Anchors Service
 * 
 * Exports cryptographic trust anchors for 3rd-party verification:
 * - Public keys with metadata
 * - Policy hashes
 * - Attestation chain roots
 * 
 * Designed for distribution to external auditors and regulators.
 */
import { createHash } from 'crypto';
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { WORKSPACE_ROOT } from './config';
import { canonicalJSON } from './ledger-hash';
import { exportPoliciesForVerification } from './policy-repository';
import { listAttestations, readAttestation } from './attestation-service';

const KEYS_DIR = join(WORKSPACE_ROOT, '00_SYSTEM', 'keys');
const TRUST_ANCHORS_DIR = join(WORKSPACE_ROOT, '00_SYSTEM', 'trust-anchors');

// ========== Types ==========

export interface PublicKeyAnchor {
  key_id: string;
  algorithm: string;
  public_key_pem: string;
  fingerprint: string;
  status: 'active' | 'archived' | 'revoked';
  created_at: string | null;
  revoked_at: string | null;
  revocation_reason: string | null;
}

export interface PolicyAnchor {
  policy_id: string;
  version: string;
  key_class: string;
  policy_hash: string;
}

export interface AttestationAnchor {
  attestation_id: string;
  period_label: string;
  attestation_hash: string;
  signed_at: string;
  key_id: string;
}

export interface TrustAnchorsBundle {
  bundle_version: string;
  bundle_id: string;
  generated_at: string;
  organization: string;
  keys: PublicKeyAnchor[];
  policies: PolicyAnchor[];
  attestations: AttestationAnchor[];
  chain_root: {
    first_attestation_hash: string | null;
    latest_attestation_hash: string | null;
    total_attestations: number;
  };
  bundle_hash: string;
}

// ========== Helpers ==========

function ensureTrustAnchorsDir(): void {
  if (!existsSync(TRUST_ANCHORS_DIR)) {
    mkdirSync(TRUST_ANCHORS_DIR, { recursive: true });
  }
}

function computeKeyFingerprint(publicKeyPem: string): string {
  return createHash('sha256').update(publicKeyPem).digest('hex').slice(0, 32);
}

// ========== Key Collection ==========

function collectPublicKeys(): PublicKeyAnchor[] {
  const keys: PublicKeyAnchor[] = [];
  
  // Active key
  const activeKeyIdFile = join(KEYS_DIR, 'active', 'key_id.txt');
  const activePubFile = join(KEYS_DIR, 'active', 'evidence-signing.pub');
  
  if (existsSync(activeKeyIdFile) && existsSync(activePubFile)) {
    const keyId = readFileSync(activeKeyIdFile, 'utf8').trim();
    const pubKey = readFileSync(activePubFile, 'utf8');
    
    let createdAt: string | null = null;
    const metaFile = join(KEYS_DIR, 'active', 'metadata.json');
    if (existsSync(metaFile)) {
      try {
        const meta = JSON.parse(readFileSync(metaFile, 'utf8'));
        createdAt = meta.created_at ?? null;
      } catch { /* ignore */ }
    }
    
    keys.push({
      key_id: keyId,
      algorithm: 'Ed25519',
      public_key_pem: pubKey,
      fingerprint: computeKeyFingerprint(pubKey),
      status: 'active',
      created_at: createdAt,
      revoked_at: null,
      revocation_reason: null,
    });
  }
  
  // Archived keys
  const archivedDir = join(KEYS_DIR, 'archived');
  if (existsSync(archivedDir)) {
    const keyDirs = readdirSync(archivedDir).filter(d => 
      statSync(join(archivedDir, d)).isDirectory()
    );
    
    for (const keyId of keyDirs) {
      const pubFile = join(archivedDir, keyId, 'evidence-signing.pub');
      if (!existsSync(pubFile)) continue;
      
      const pubKey = readFileSync(pubFile, 'utf8');
      
      let status: 'archived' | 'revoked' = 'archived';
      let createdAt: string | null = null;
      let revokedAt: string | null = null;
      let revocationReason: string | null = null;
      
      const metaFile = join(archivedDir, keyId, 'metadata.json');
      if (existsSync(metaFile)) {
        try {
          const meta = JSON.parse(readFileSync(metaFile, 'utf8'));
          createdAt = meta.created_at ?? null;
          if (meta.revoked) {
            status = 'revoked';
            revokedAt = meta.revoked_at ?? null;
            revocationReason = meta.revocation_reason ?? null;
          }
        } catch { /* ignore */ }
      }
      
      keys.push({
        key_id: keyId,
        algorithm: 'Ed25519',
        public_key_pem: pubKey,
        fingerprint: computeKeyFingerprint(pubKey),
        status,
        created_at: createdAt,
        revoked_at: revokedAt,
        revocation_reason: revocationReason,
      });
    }
  }
  
  // Sort by created_at descending (newest first)
  keys.sort((a, b) => {
    if (!a.created_at) return 1;
    if (!b.created_at) return -1;
    return b.created_at.localeCompare(a.created_at);
  });
  
  return keys;
}

// ========== Trust Anchors Generation ==========

export function generateTrustAnchorsBundle(organization: string): TrustAnchorsBundle {
  ensureTrustAnchorsDir();
  
  // Collect keys
  const keys = collectPublicKeys();
  
  // Collect policies
  const policiesExport = exportPoliciesForVerification();
  const policies: PolicyAnchor[] = policiesExport.policies.map(p => ({
    policy_id: p.policy_id,
    version: p.version,
    key_class: p.key_class,
    policy_hash: p.policy_hash,
  }));
  
  // Collect attestations
  const attestationsList = listAttestations();
  const attestations: AttestationAnchor[] = [];
  
  for (const a of attestationsList) {
    const signed = readAttestation(a.filename);
    if (signed) {
      attestations.push({
        attestation_id: signed.attestation.attestation_id,
        period_label: signed.attestation.period.label,
        attestation_hash: signed.attestation.attestation_hash,
        signed_at: signed.signed_at,
        key_id: signed.key_id,
      });
    }
  }
  
  // Compute chain root
  const sortedAttestations = [...attestations].sort((a, b) => 
    a.signed_at.localeCompare(b.signed_at)
  );
  
  const chainRoot = {
    first_attestation_hash: sortedAttestations[0]?.attestation_hash ?? null,
    latest_attestation_hash: sortedAttestations[sortedAttestations.length - 1]?.attestation_hash ?? null,
    total_attestations: attestations.length,
  };
  
  // Build bundle
  const bundleBase = {
    bundle_version: '1.0.0',
    bundle_id: crypto.randomUUID(),
    generated_at: new Date().toISOString(),
    organization,
    keys,
    policies,
    attestations,
    chain_root: chainRoot,
  };
  
  const bundleHash = createHash('sha256')
    .update(canonicalJSON(bundleBase as Record<string, unknown>))
    .digest('hex');
  
  return { ...bundleBase, bundle_hash: bundleHash };
}

/**
 * Saves the trust anchors bundle to disk.
 */
export function saveTrustAnchorsBundle(bundle: TrustAnchorsBundle): string {
  ensureTrustAnchorsDir();
  
  const date = new Date().toISOString().slice(0, 10);
  const filename = `trust-anchors-${date}-${bundle.bundle_id.slice(0, 8)}.json`;
  const filepath = join(TRUST_ANCHORS_DIR, filename);
  
  writeFileSync(filepath, JSON.stringify(bundle, null, 2), 'utf8');
  
  // Also write a "latest" symlink-like file
  const latestPath = join(TRUST_ANCHORS_DIR, 'trust-anchors-latest.json');
  writeFileSync(latestPath, JSON.stringify(bundle, null, 2), 'utf8');
  
  return filepath;
}

/**
 * Generates and saves the trust anchors bundle.
 */
export function exportTrustAnchors(organization: string): {
  filepath: string;
  bundle: TrustAnchorsBundle;
} {
  const bundle = generateTrustAnchorsBundle(organization);
  const filepath = saveTrustAnchorsBundle(bundle);
  return { filepath, bundle };
}

/**
 * Generates a minimal public key export for distribution.
 */
export function exportPublicKeysOnly(): {
  exported_at: string;
  keys: Array<{
    key_id: string;
    algorithm: string;
    public_key_pem: string;
    fingerprint: string;
    status: string;
  }>;
} {
  const keys = collectPublicKeys();
  return {
    exported_at: new Date().toISOString(),
    keys: keys.map(k => ({
      key_id: k.key_id,
      algorithm: k.algorithm,
      public_key_pem: k.public_key_pem,
      fingerprint: k.fingerprint,
      status: k.status,
    })),
  };
}

/**
 * Lists all trust anchor bundles.
 */
export function listTrustAnchorsBundles(): Array<{
  filename: string;
  generated_at: string;
  organization: string;
  bundle_id: string;
}> {
  ensureTrustAnchorsDir();
  
  const files = readdirSync(TRUST_ANCHORS_DIR)
    .filter(f => f.startsWith('trust-anchors-') && f.endsWith('.json') && f !== 'trust-anchors-latest.json')
    .sort()
    .reverse();
  
  return files.map(f => {
    try {
      const content = readFileSync(join(TRUST_ANCHORS_DIR, f), 'utf8');
      const bundle = JSON.parse(content) as TrustAnchorsBundle;
      return {
        filename: f,
        generated_at: bundle.generated_at,
        organization: bundle.organization,
        bundle_id: bundle.bundle_id,
      };
    } catch {
      return {
        filename: f,
        generated_at: 'Unknown',
        organization: 'Unknown',
        bundle_id: 'Unknown',
      };
    }
  });
}
