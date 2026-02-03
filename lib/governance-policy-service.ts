/**
 * Governance Policy Service
 * N-of-M approval policies, org/team scope, delegated approvers.
 */
import { createHash } from 'crypto';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { WORKSPACE_ROOT } from './config';
import { canonicalJSON, computeEventHash } from './ledger-hash';
import { getDb, getDbReadOnly } from './db';

// ========== Types ==========

export type KeyClass = 'standard' | 'critical' | 'root';

export type ApprovalPolicy = {
  policy_id: string;
  name: string;
  description: string;
  key_class: KeyClass;
  required_approvals: number;  // N
  total_approvers: number;     // M (0 = any eligible)
  approval_timeout_hours: number;
  execution_timeout_hours: number;
  org_scope: string | null;    // null = global
  team_scope: string | null;   // null = all teams
  require_different_teams: boolean;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type DelegatedApprover = {
  delegation_id: string;
  delegator_id: string;
  delegate_id: string;
  key_classes: KeyClass[];
  org_scope: string | null;
  team_scope: string | null;
  max_approvals: number;       // cap per period
  approvals_used: number;
  period_start: string;
  period_hours: number;
  valid_from: string;
  valid_until: string | null;
  reason: string;
  created_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
};

export type OrgUnit = {
  org_id: string;
  name: string;
  parent_org_id: string | null;
  created_at: string;
};

export type Team = {
  team_id: string;
  org_id: string;
  name: string;
  created_at: string;
};

export type UserOrgAssignment = {
  user_id: string;
  org_id: string;
  team_id: string | null;
  role: 'member' | 'lead' | 'admin';
  assigned_at: string;
};

// ========== Storage ==========

const DATA_DIR = join(WORKSPACE_ROOT, '00_SYSTEM', 'governance');

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function loadPolicies(): ApprovalPolicy[] {
  const file = join(DATA_DIR, 'approval-policies.json');
  if (!existsSync(file)) return getDefaultPolicies();
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return getDefaultPolicies();
  }
}

function savePolicies(items: ApprovalPolicy[]): void {
  ensureDataDir();
  writeFileSync(join(DATA_DIR, 'approval-policies.json'), JSON.stringify(items, null, 2), 'utf8');
}

function loadDelegations(): DelegatedApprover[] {
  const file = join(DATA_DIR, 'delegations.json');
  if (!existsSync(file)) return [];
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

function saveDelegations(items: DelegatedApprover[]): void {
  ensureDataDir();
  writeFileSync(join(DATA_DIR, 'delegations.json'), JSON.stringify(items, null, 2), 'utf8');
}

function loadOrgs(): OrgUnit[] {
  const file = join(DATA_DIR, 'orgs.json');
  if (!existsSync(file)) return [{ org_id: 'default', name: 'Default Organization', parent_org_id: null, created_at: new Date().toISOString() }];
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

function saveOrgs(items: OrgUnit[]): void {
  ensureDataDir();
  writeFileSync(join(DATA_DIR, 'orgs.json'), JSON.stringify(items, null, 2), 'utf8');
}

function loadTeams(): Team[] {
  const file = join(DATA_DIR, 'teams.json');
  if (!existsSync(file)) return [];
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

function saveTeams(items: Team[]): void {
  ensureDataDir();
  writeFileSync(join(DATA_DIR, 'teams.json'), JSON.stringify(items, null, 2), 'utf8');
}

function loadUserAssignments(): UserOrgAssignment[] {
  const file = join(DATA_DIR, 'user-assignments.json');
  if (!existsSync(file)) return [];
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

function saveUserAssignments(items: UserOrgAssignment[]): void {
  ensureDataDir();
  writeFileSync(join(DATA_DIR, 'user-assignments.json'), JSON.stringify(items, null, 2), 'utf8');
}

// ========== Default Policies ==========

function getDefaultPolicies(): ApprovalPolicy[] {
  return [
    {
      policy_id: 'policy-standard',
      name: 'Standard Key Operations',
      description: '2-of-N for standard key rotate/revoke',
      key_class: 'standard',
      required_approvals: 2,
      total_approvers: 0, // any eligible
      approval_timeout_hours: 24,
      execution_timeout_hours: 1,
      org_scope: null,
      team_scope: null,
      require_different_teams: false,
      enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      policy_id: 'policy-critical',
      name: 'Critical Key Operations',
      description: '3-of-N with different teams for critical keys',
      key_class: 'critical',
      required_approvals: 3,
      total_approvers: 0,
      approval_timeout_hours: 48,
      execution_timeout_hours: 2,
      org_scope: null,
      team_scope: null,
      require_different_teams: true,
      enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      policy_id: 'policy-root',
      name: 'Root Key Operations',
      description: '4-of-5 quorum for root key operations',
      key_class: 'root',
      required_approvals: 4,
      total_approvers: 5,
      approval_timeout_hours: 72,
      execution_timeout_hours: 4,
      org_scope: null,
      team_scope: null,
      require_different_teams: true,
      enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];
}

// ========== Approval Policies ==========

export function getPolicy(keyClass: KeyClass, orgId?: string, teamId?: string): ApprovalPolicy {
  const policies = loadPolicies();
  
  // Find most specific matching policy
  const matches = policies
    .filter(p => p.enabled && p.key_class === keyClass)
    .filter(p => {
      if (p.org_scope && p.org_scope !== orgId) return false;
      if (p.team_scope && p.team_scope !== teamId) return false;
      return true;
    })
    .sort((a, b) => {
      // More specific policies first
      const aScore = (a.org_scope ? 2 : 0) + (a.team_scope ? 1 : 0);
      const bScore = (b.org_scope ? 2 : 0) + (b.team_scope ? 1 : 0);
      return bScore - aScore;
    });
  
  return matches[0] ?? getDefaultPolicies().find(p => p.key_class === keyClass)!;
}

export function listPolicies(): ApprovalPolicy[] {
  return loadPolicies();
}

export function createPolicy(input: Omit<ApprovalPolicy, 'policy_id' | 'created_at' | 'updated_at'>): ApprovalPolicy {
  const policies = loadPolicies();
  
  const policy: ApprovalPolicy = {
    ...input,
    policy_id: `policy-${crypto.randomUUID().slice(0, 8)}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  policies.push(policy);
  savePolicies(policies);
  
  logPolicyEvent('POLICY_CREATED', { policy_id: policy.policy_id, name: policy.name }, 'system');
  
  return policy;
}

export function updatePolicy(policyId: string, updates: Partial<ApprovalPolicy>): ApprovalPolicy | null {
  const policies = loadPolicies();
  const policy = policies.find(p => p.policy_id === policyId);
  
  if (!policy) return null;
  
  Object.assign(policy, updates, { updated_at: new Date().toISOString() });
  savePolicies(policies);
  
  logPolicyEvent('POLICY_UPDATED', { policy_id: policyId }, 'system');
  
  return policy;
}

// ========== Delegated Approvers ==========

export function createDelegation(input: {
  delegator_id: string;
  delegate_id: string;
  key_classes: KeyClass[];
  org_scope?: string;
  team_scope?: string;
  max_approvals: number;
  period_hours: number;
  valid_until?: string;
  reason: string;
}): DelegatedApprover {
  const delegations = loadDelegations();
  
  const delegation: DelegatedApprover = {
    delegation_id: crypto.randomUUID(),
    delegator_id: input.delegator_id,
    delegate_id: input.delegate_id,
    key_classes: input.key_classes,
    org_scope: input.org_scope ?? null,
    team_scope: input.team_scope ?? null,
    max_approvals: input.max_approvals,
    approvals_used: 0,
    period_start: new Date().toISOString(),
    period_hours: input.period_hours,
    valid_from: new Date().toISOString(),
    valid_until: input.valid_until ?? null,
    reason: input.reason,
    created_at: new Date().toISOString(),
    revoked_at: null,
    revoked_by: null,
  };
  
  delegations.push(delegation);
  saveDelegations(delegations);
  
  logPolicyEvent('DELEGATION_CREATED', {
    delegation_id: delegation.delegation_id,
    delegator: input.delegator_id,
    delegate: input.delegate_id,
  }, input.delegator_id);
  
  return delegation;
}

export function revokeDelegation(delegationId: string, revokedBy: string): DelegatedApprover | null {
  const delegations = loadDelegations();
  const delegation = delegations.find(d => d.delegation_id === delegationId);
  
  if (!delegation || delegation.revoked_at) return null;
  
  delegation.revoked_at = new Date().toISOString();
  delegation.revoked_by = revokedBy;
  
  saveDelegations(delegations);
  
  logPolicyEvent('DELEGATION_REVOKED', { delegation_id: delegationId }, revokedBy);
  
  return delegation;
}

export function getActiveDelegations(userId: string): DelegatedApprover[] {
  const delegations = loadDelegations();
  const now = new Date();
  
  return delegations.filter(d => {
    if (d.delegate_id !== userId) return false;
    if (d.revoked_at) return false;
    if (d.valid_until && new Date(d.valid_until) < now) return false;
    return true;
  });
}

export function canApproveWithDelegation(userId: string, keyClass: KeyClass, orgId?: string, teamId?: string): {
  can_approve: boolean;
  delegation?: DelegatedApprover;
  remaining_approvals?: number;
} {
  const delegations = getActiveDelegations(userId);
  
  for (const d of delegations) {
    // Check key class
    if (!d.key_classes.includes(keyClass)) continue;
    
    // Check scope
    if (d.org_scope && d.org_scope !== orgId) continue;
    if (d.team_scope && d.team_scope !== teamId) continue;
    
    // Check quota
    const periodEnd = new Date(new Date(d.period_start).getTime() + d.period_hours * 60 * 60 * 1000);
    if (new Date() > periodEnd) {
      // Reset period
      d.period_start = new Date().toISOString();
      d.approvals_used = 0;
      saveDelegations(loadDelegations().map(x => x.delegation_id === d.delegation_id ? d : x));
    }
    
    if (d.approvals_used >= d.max_approvals) continue;
    
    return {
      can_approve: true,
      delegation: d,
      remaining_approvals: d.max_approvals - d.approvals_used,
    };
  }
  
  return { can_approve: false };
}

export function recordDelegatedApproval(delegationId: string): void {
  const delegations = loadDelegations();
  const d = delegations.find(x => x.delegation_id === delegationId);
  if (d) {
    d.approvals_used++;
    saveDelegations(delegations);
  }
}

// ========== Org/Team Management ==========

export function listOrgs(): OrgUnit[] {
  return loadOrgs();
}

export function createOrg(name: string, parentOrgId?: string): OrgUnit {
  const orgs = loadOrgs();
  
  const org: OrgUnit = {
    org_id: `org-${crypto.randomUUID().slice(0, 8)}`,
    name,
    parent_org_id: parentOrgId ?? null,
    created_at: new Date().toISOString(),
  };
  
  orgs.push(org);
  saveOrgs(orgs);
  
  return org;
}

export function listTeams(orgId?: string): Team[] {
  const teams = loadTeams();
  if (orgId) return teams.filter(t => t.org_id === orgId);
  return teams;
}

export function createTeam(orgId: string, name: string): Team {
  const teams = loadTeams();
  
  const team: Team = {
    team_id: `team-${crypto.randomUUID().slice(0, 8)}`,
    org_id: orgId,
    name,
    created_at: new Date().toISOString(),
  };
  
  teams.push(team);
  saveTeams(teams);
  
  return team;
}

export function assignUserToOrg(userId: string, orgId: string, teamId?: string, role: 'member' | 'lead' | 'admin' = 'member'): UserOrgAssignment {
  const assignments = loadUserAssignments();
  
  // Remove existing assignment for this user in this org
  const filtered = assignments.filter(a => !(a.user_id === userId && a.org_id === orgId));
  
  const assignment: UserOrgAssignment = {
    user_id: userId,
    org_id: orgId,
    team_id: teamId ?? null,
    role,
    assigned_at: new Date().toISOString(),
  };
  
  filtered.push(assignment);
  saveUserAssignments(filtered);
  
  return assignment;
}

export function getUserAssignments(userId: string): UserOrgAssignment[] {
  return loadUserAssignments().filter(a => a.user_id === userId);
}

export function getUserTeam(userId: string, orgId?: string): { org_id: string; team_id: string | null } | null {
  const assignments = loadUserAssignments().filter(a => a.user_id === userId);
  if (orgId) {
    const a = assignments.find(x => x.org_id === orgId);
    return a ? { org_id: a.org_id, team_id: a.team_id } : null;
  }
  return assignments[0] ? { org_id: assignments[0].org_id, team_id: assignments[0].team_id } : null;
}

// ========== Approval Validation ==========

export type ApprovalValidation = {
  valid: boolean;
  policy: ApprovalPolicy;
  current_approvals: number;
  required_approvals: number;
  approvers: string[];
  errors: string[];
  can_execute: boolean;
};

export function validateApprovals(
  requestId: string,
  keyClass: KeyClass,
  orgId?: string,
  teamId?: string
): ApprovalValidation {
  const policy = getPolicy(keyClass, orgId, teamId);
  const db = getDbReadOnly();
  
  // Get approvals from ledger
  const approvalEvents = db.prepare(`
    SELECT payload_json, actor_id FROM ledger_events
    WHERE event_type = 'KEY_REQUEST_APPROVED'
    AND json_extract(payload_json, '$.request_id') = ?
  `).all(requestId) as { payload_json: string; actor_id: string }[];
  
  const approvers = approvalEvents.map(e => e.actor_id);
  const uniqueApprovers = Array.from(new Set(approvers));
  
  const errors: string[] = [];
  
  // Check required approvals
  if (uniqueApprovers.length < policy.required_approvals) {
    errors.push(`Need ${policy.required_approvals} approvals, have ${uniqueApprovers.length}`);
  }
  
  // Check total_approvers constraint (quorum)
  if (policy.total_approvers > 0) {
    // In a real system, would check against defined approver pool
    // For now, just check we have enough unique approvers
  }
  
  // Check different teams requirement
  if (policy.require_different_teams && uniqueApprovers.length >= 2) {
    const teams = new Set<string>();
    for (const approverId of uniqueApprovers) {
      const assignment = getUserTeam(approverId);
      if (assignment?.team_id) teams.add(assignment.team_id);
    }
    if (teams.size < Math.min(2, uniqueApprovers.length)) {
      errors.push('Approvals must come from different teams');
    }
  }
  
  return {
    valid: errors.length === 0,
    policy,
    current_approvals: uniqueApprovers.length,
    required_approvals: policy.required_approvals,
    approvers: uniqueApprovers,
    errors,
    can_execute: errors.length === 0 && uniqueApprovers.length >= policy.required_approvals,
  };
}

// ========== Ledger Integration ==========

function logPolicyEvent(eventType: string, payload: Record<string, unknown>, actorId: string): string {
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
