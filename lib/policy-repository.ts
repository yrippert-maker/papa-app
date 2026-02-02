/**
 * Policy Repository Service
 * 
 * Manages versioned governance policies with:
 * - Git-friendly file-based storage
 * - Version history tracking
 * - Policy hash computation for integrity
 * - Changelog generation
 */
import { createHash } from 'crypto';
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { canonicalJSON } from './ledger-hash';

// Policies are stored in repo (Git-tracked)
const POLICIES_DIR = join(process.cwd(), 'schemas', 'policies');
const POLICY_INDEX_FILE = join(POLICIES_DIR, 'POLICY_INDEX.json');
const CHANGELOG_FILE = join(POLICIES_DIR, 'CHANGELOG.md');

// ========== Types ==========

export type KeyClass = 'standard' | 'critical' | 'root';
export type QuorumType = 'n_of_any' | 'n_of_m' | 'unanimous';

export interface BlockedHours {
  day: string;
  start_hour: number;
  end_hour: number;
}

export interface ApprovalPolicy {
  policy_id: string;
  version: string;
  name: string;
  description: string;
  key_class: KeyClass;
  approval_requirements: {
    min_approvers: number;
    total_pool: number;
    quorum_type: QuorumType;
  };
  timeouts: {
    approval_hours: number;
    execution_hours: number;
  };
  constraints: {
    require_different_teams: boolean;
    require_different_orgs: boolean;
    require_senior_approver: boolean;
    blocked_hours: BlockedHours[];
  };
  scope: {
    org_id: string | null;
    team_id: string | null;
  };
  enabled: boolean;
  metadata: {
    created_at: string;
    created_by: string;
    approved_at: string;
    approved_by: string;
    effective_date: string;
    review_date: string;
    deprecated: boolean;
    superseded_by: string | null;
  };
}

export interface PolicyHistoryEntry {
  version: string;
  effective_date: string;
  file: string;
  changelog: string;
}

export interface PolicyIndexEntry {
  policy_id: string;
  current_version: string;
  key_class: KeyClass;
  status: 'active' | 'deprecated' | 'archived';
  file: string;
  history: PolicyHistoryEntry[];
}

export interface PolicyIndex {
  index_version: string;
  generated_at: string;
  description: string;
  policies: PolicyIndexEntry[];
  schema_version: string;
}

export interface ChangelogEntry {
  date: string;
  policy_id: string;
  from_version: string | null;
  to_version: string;
  change_type: 'created' | 'updated' | 'deprecated' | 'archived';
  summary: string;
  changed_by: string;
  approved_by: string;
}

// ========== Hash Computation ==========

/**
 * Computes policy hash excluding metadata for integrity verification.
 */
export function computePolicyHash(policy: ApprovalPolicy): string {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { metadata, ...policyWithoutMeta } = policy;
  const canonical = canonicalJSON(policyWithoutMeta as Record<string, unknown>);
  return createHash('sha256').update(canonical).digest('hex');
}

// ========== Index Management ==========

/**
 * Loads the policy index.
 */
export function loadPolicyIndex(): PolicyIndex {
  if (!existsSync(POLICY_INDEX_FILE)) {
    return {
      index_version: '1.0.0',
      generated_at: new Date().toISOString(),
      description: 'Index of all governance policies with versioning metadata',
      policies: [],
      schema_version: 'approval-policy-v1.json',
    };
  }
  return JSON.parse(readFileSync(POLICY_INDEX_FILE, 'utf8'));
}

/**
 * Saves the policy index.
 */
export function savePolicyIndex(index: PolicyIndex): void {
  index.generated_at = new Date().toISOString();
  writeFileSync(POLICY_INDEX_FILE, JSON.stringify(index, null, 2), 'utf8');
}

// ========== Policy Loading ==========

/**
 * Loads a specific policy by ID and optional version.
 */
export function loadPolicy(policyId: string, version?: string): ApprovalPolicy | null {
  const index = loadPolicyIndex();
  const entry = index.policies.find(p => p.policy_id === policyId);
  
  if (!entry) return null;
  
  const targetVersion = version ?? entry.current_version;
  const historyEntry = entry.history.find(h => h.version === targetVersion);
  
  if (!historyEntry) return null;
  
  const filepath = join(POLICIES_DIR, historyEntry.file);
  if (!existsSync(filepath)) return null;
  
  return JSON.parse(readFileSync(filepath, 'utf8'));
}

/**
 * Loads the effective policy for a key class.
 */
export function getEffectivePolicy(keyClass: KeyClass): ApprovalPolicy | null {
  const index = loadPolicyIndex();
  const entry = index.policies.find(
    p => p.key_class === keyClass && p.status === 'active'
  );
  
  if (!entry) return null;
  return loadPolicy(entry.policy_id);
}

/**
 * Lists all policies with their current status.
 */
export function listPolicies(): Array<{
  policy_id: string;
  name: string;
  key_class: KeyClass;
  version: string;
  status: string;
  policy_hash: string;
}> {
  const index = loadPolicyIndex();
  const result: Array<{
    policy_id: string;
    name: string;
    key_class: KeyClass;
    version: string;
    status: string;
    policy_hash: string;
  }> = [];
  
  for (const entry of index.policies) {
    const policy = loadPolicy(entry.policy_id);
    if (policy) {
      result.push({
        policy_id: entry.policy_id,
        name: policy.name,
        key_class: entry.key_class,
        version: entry.current_version,
        status: entry.status,
        policy_hash: computePolicyHash(policy),
      });
    }
  }
  
  return result;
}

// ========== Changelog Management ==========

/**
 * Loads changelog entries from file.
 */
export function loadChangelog(): ChangelogEntry[] {
  const changelogJsonFile = join(POLICIES_DIR, 'CHANGELOG.json');
  if (!existsSync(changelogJsonFile)) return [];
  return JSON.parse(readFileSync(changelogJsonFile, 'utf8'));
}

/**
 * Appends a changelog entry.
 */
export function appendChangelog(entry: ChangelogEntry): void {
  const entries = loadChangelog();
  entries.unshift(entry); // newest first
  
  const changelogJsonFile = join(POLICIES_DIR, 'CHANGELOG.json');
  writeFileSync(changelogJsonFile, JSON.stringify(entries, null, 2), 'utf8');
  
  // Also regenerate markdown
  regenerateChangelogMarkdown(entries);
}

/**
 * Regenerates the CHANGELOG.md file from entries.
 */
function regenerateChangelogMarkdown(entries: ChangelogEntry[]): void {
  const lines: string[] = [
    '# Policy Changelog',
    '',
    'All changes to governance policies are documented here.',
    '',
    '---',
    '',
  ];
  
  // Group by date
  const byDate = new Map<string, ChangelogEntry[]>();
  for (const e of entries) {
    const date = e.date.slice(0, 10);
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(e);
  }
  
  for (const [date, dateEntries] of byDate) {
    lines.push(`## ${date}`);
    lines.push('');
    
    for (const e of dateEntries) {
      const badge = {
        created: '🆕',
        updated: '📝',
        deprecated: '⚠️',
        archived: '📦',
      }[e.change_type];
      
      lines.push(`### ${badge} ${e.policy_id} v${e.to_version}`);
      lines.push('');
      lines.push(`- **Change Type:** ${e.change_type}`);
      if (e.from_version) {
        lines.push(`- **From Version:** ${e.from_version}`);
      }
      lines.push(`- **Summary:** ${e.summary}`);
      lines.push(`- **Changed By:** ${e.changed_by}`);
      lines.push(`- **Approved By:** ${e.approved_by}`);
      lines.push('');
    }
  }
  
  writeFileSync(CHANGELOG_FILE, lines.join('\n'), 'utf8');
}

// ========== Policy Creation/Update ==========

/**
 * Creates a new policy version.
 */
export function createPolicyVersion(
  policy: ApprovalPolicy,
  changelog: string,
  changedBy: string,
  approvedBy: string
): { success: boolean; error?: string } {
  const index = loadPolicyIndex();
  const existing = index.policies.find(p => p.policy_id === policy.policy_id);
  
  const filename = `${policy.policy_id.replace('policy-', '')}-v${policy.version}.json`;
  const filepath = join(POLICIES_DIR, filename);
  
  // Write policy file
  writeFileSync(filepath, JSON.stringify(policy, null, 2), 'utf8');
  
  const historyEntry: PolicyHistoryEntry = {
    version: policy.version,
    effective_date: policy.metadata.effective_date,
    file: filename,
    changelog,
  };
  
  if (existing) {
    // Update existing policy
    const oldVersion = existing.current_version;
    existing.current_version = policy.version;
    existing.file = filename;
    existing.history.unshift(historyEntry);
    
    appendChangelog({
      date: new Date().toISOString(),
      policy_id: policy.policy_id,
      from_version: oldVersion,
      to_version: policy.version,
      change_type: 'updated',
      summary: changelog,
      changed_by: changedBy,
      approved_by: approvedBy,
    });
  } else {
    // New policy
    index.policies.push({
      policy_id: policy.policy_id,
      current_version: policy.version,
      key_class: policy.key_class,
      status: 'active',
      file: filename,
      history: [historyEntry],
    });
    
    appendChangelog({
      date: new Date().toISOString(),
      policy_id: policy.policy_id,
      from_version: null,
      to_version: policy.version,
      change_type: 'created',
      summary: changelog,
      changed_by: changedBy,
      approved_by: approvedBy,
    });
  }
  
  savePolicyIndex(index);
  return { success: true };
}

/**
 * Deprecates a policy (marks for future removal).
 */
export function deprecatePolicy(
  policyId: string,
  supersededBy: string | null,
  changedBy: string,
  approvedBy: string
): { success: boolean; error?: string } {
  const index = loadPolicyIndex();
  const entry = index.policies.find(p => p.policy_id === policyId);
  
  if (!entry) return { success: false, error: 'Policy not found' };
  if (entry.status !== 'active') return { success: false, error: 'Policy not active' };
  
  entry.status = 'deprecated';
  
  // Update the policy file
  const policy = loadPolicy(policyId);
  if (policy) {
    policy.metadata.deprecated = true;
    policy.metadata.superseded_by = supersededBy;
    const filepath = join(POLICIES_DIR, entry.file);
    writeFileSync(filepath, JSON.stringify(policy, null, 2), 'utf8');
  }
  
  appendChangelog({
    date: new Date().toISOString(),
    policy_id: policyId,
    from_version: entry.current_version,
    to_version: entry.current_version,
    change_type: 'deprecated',
    summary: supersededBy 
      ? `Deprecated in favor of ${supersededBy}` 
      : 'Deprecated without replacement',
    changed_by: changedBy,
    approved_by: approvedBy,
  });
  
  savePolicyIndex(index);
  return { success: true };
}

// ========== Validation ==========

/**
 * Validates a policy against the schema constraints.
 */
export function validatePolicy(policy: ApprovalPolicy): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Basic field checks
  if (!policy.policy_id.match(/^policy-[a-z0-9-]+$/)) {
    errors.push('Invalid policy_id format');
  }
  if (!policy.version.match(/^\d+\.\d+\.\d+$/)) {
    errors.push('Invalid version format (expected semver)');
  }
  if (!['standard', 'critical', 'root'].includes(policy.key_class)) {
    errors.push('Invalid key_class');
  }
  
  // Approval requirements
  const { min_approvers, total_pool, quorum_type } = policy.approval_requirements;
  if (min_approvers < 2 || min_approvers > 10) {
    errors.push('min_approvers must be 2-10');
  }
  if (quorum_type === 'n_of_m' && total_pool < min_approvers) {
    errors.push('total_pool must be >= min_approvers for n_of_m quorum');
  }
  
  // Timeouts
  if (policy.timeouts.approval_hours < 1 || policy.timeouts.approval_hours > 168) {
    errors.push('approval_hours must be 1-168');
  }
  if (policy.timeouts.execution_hours < 1 || policy.timeouts.execution_hours > 24) {
    errors.push('execution_hours must be 1-24');
  }
  
  return { valid: errors.length === 0, errors };
}

// ========== Export for External Verification ==========

/**
 * Exports all policies with hashes for external verification.
 */
export function exportPoliciesForVerification(): {
  exported_at: string;
  policies: Array<{
    policy_id: string;
    version: string;
    key_class: KeyClass;
    policy_hash: string;
    file: string;
  }>;
  index_hash: string;
} {
  const index = loadPolicyIndex();
  const policies: Array<{
    policy_id: string;
    version: string;
    key_class: KeyClass;
    policy_hash: string;
    file: string;
  }> = [];
  
  for (const entry of index.policies) {
    if (entry.status !== 'active') continue;
    const policy = loadPolicy(entry.policy_id);
    if (policy) {
      policies.push({
        policy_id: entry.policy_id,
        version: entry.current_version,
        key_class: entry.key_class,
        policy_hash: computePolicyHash(policy),
        file: entry.file,
      });
    }
  }
  
  const indexHash = createHash('sha256')
    .update(canonicalJSON(index as unknown as Record<string, unknown>))
    .digest('hex');
  
  return {
    exported_at: new Date().toISOString(),
    policies,
    index_hash: indexHash,
  };
}
