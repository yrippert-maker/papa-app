/**
 * Decision History Service
 * Lists verification decision records from audit packs (workspace + fixtures).
 * Data contract: DECISION_RECORD_SPEC.md
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { WORKSPACE_ROOT } from './config';

const AUDIT_PACKS_DIR = join(WORKSPACE_ROOT, '00_SYSTEM', 'audit-packs');
const FIXTURES_DIR = join(process.cwd(), '__fixtures__');

export type DecisionSummary = {
  decision_id: string;
  generated_at: string;
  outcome: 'pass' | 'fail';
  outcome_why: string;
  pack_id: string | null;
  ledger_entry_id: string | null;
  pack_path: string;
};

export type DecisionDetail = DecisionSummary & {
  decision_fingerprint_sha256: string;
  pack_ref: { dir: string; pack_id: string | null; pack_sha256: string | null };
  checks: Array<{ id: string; name: string; outcome: string; reason: string | null }>;
  rules_fired: Array<{ rule_type: string; message: string; runbook: string | null }>;
  approval: { mode: string; policy_ref: string | null; approved_at: string | null };
  references: { verify_summary: string; ledger_entry: string | null };
};

function safeReadJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return null;
  }
}

export function listDecisions(): DecisionSummary[] {
  const all: DecisionSummary[] = [];

  // Workspace audit packs
  if (existsSync(AUDIT_PACKS_DIR)) {
    const items = readdirSync(AUDIT_PACKS_DIR);
    for (const item of items) {
      const fullPath = join(AUDIT_PACKS_DIR, item);
      const stat = statSync(fullPath);
      if (stat.isDirectory() && item.startsWith('audit-pack-')) {
        const drPath = join(fullPath, 'decision-record.json');
        const dr = safeReadJson<{ decision_id?: string; generated_at?: string; outcome?: { overall?: string; why?: string }; pack_ref?: { pack_id?: string | null }; ledger_entry_id?: string | null }>(drPath);
        if (dr?.decision_id) {
          all.push({
            decision_id: dr.decision_id,
            generated_at: dr.generated_at ?? '',
            outcome: (dr.outcome?.overall === 'pass' ? 'pass' : 'fail') as 'pass' | 'fail',
            outcome_why: dr.outcome?.why ?? '',
            pack_id: dr.pack_ref?.pack_id ?? null,
            ledger_entry_id: dr.ledger_entry_id ?? null,
            pack_path: fullPath,
          });
        }
      }
    }
  }

  // Fixtures (demo)
  for (const name of ['auditor-pack-minimal', 'auditor-pack-bad-receipt']) {
    const packDir = join(FIXTURES_DIR, name);
    const drPath = join(packDir, 'decision-record.json');
    const dr = safeReadJson<{ decision_id?: string; generated_at?: string; outcome?: { overall?: string; why?: string }; pack_ref?: { pack_id?: string | null }; ledger_entry_id?: string | null }>(drPath);
    if (dr?.decision_id) {
      all.push({
        decision_id: dr.decision_id,
        generated_at: dr.generated_at ?? '',
        outcome: (dr.outcome?.overall === 'pass' ? 'pass' : 'fail') as 'pass' | 'fail',
        outcome_why: dr.outcome?.why ?? '',
        pack_id: dr.pack_ref?.pack_id ?? null,
        ledger_entry_id: dr.ledger_entry_id ?? null,
        pack_path: packDir,
      });
    }
  }

  return all.sort((a, b) => b.generated_at.localeCompare(a.generated_at));
}

export function getDecision(decisionId: string): DecisionDetail | null {
  const list = listDecisions();
  const found = list.find((d) => d.decision_id === decisionId);
  if (!found) return null;

  const drPath = join(found.pack_path, 'decision-record.json');
  const dr = safeReadJson<{
    decision_id?: string;
    decision_fingerprint_sha256?: string;
    generated_at?: string;
    outcome?: { overall?: string; why?: string };
    pack_ref?: { dir: string; pack_id: string | null; pack_sha256: string | null };
    ledger_entry_id?: string | null;
    checks?: Array<{ id: string; name: string; outcome: string; reason: string | null }>;
    rules_fired?: Array<{ rule_type: string; message: string; runbook: string | null }>;
    approval?: { mode: string; policy_ref: string | null; approved_at: string | null };
    references?: { verify_summary: string; ledger_entry: string | null };
  }>(drPath);

  if (!dr) return null;

  return {
    ...found,
    decision_fingerprint_sha256: dr.decision_fingerprint_sha256 ?? '',
    pack_ref: dr.pack_ref ?? { dir: '', pack_id: null, pack_sha256: null },
    checks: dr.checks ?? [],
    rules_fired: dr.rules_fired ?? [],
    approval: dr.approval ?? { mode: 'auto', policy_ref: null, approved_at: null },
    references: dr.references ?? { verify_summary: '', ledger_entry: null },
  };
}
