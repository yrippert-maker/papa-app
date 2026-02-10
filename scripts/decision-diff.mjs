#!/usr/bin/env node
/**
 * Decision Diff — Semantic comparison of two compliance decisions
 *
 * Explains: "What changed between two compliance decisions — and why?"
 *
 * Usage:
 *   node decision-diff.mjs --from decision-A.json --to decision-B.json
 *   node decision-diff.mjs --from A.json --to B.json --format md
 *   node decision-diff.mjs --from A.json --to B.json --output ./diff
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function safeReadJson(p) {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch (e) {
    throw new Error(`Failed to read ${p}: ${e.message}`);
  }
}

function get(obj, path, def = null) {
  const parts = path.split('.');
  let v = obj;
  for (const k of parts) {
    if (v == null) return def;
    v = v[k];
  }
  return v ?? def;
}

function stableStringify(obj) {
  if (obj == null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

/** Semantic diff between two decision records */
function computeDiff(from, to) {
  const diff = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    from: { decision_id: from.decision_id, fingerprint: from.decision_fingerprint_sha256 },
    to: { decision_id: to.decision_id, fingerprint: to.decision_fingerprint_sha256 },
    context_diff: {},
    evidence_diff: {},
    checks_diff: {},
    rules_diff: {},
    outcome_diff: {},
    why_diff: {},
    summary: null,
  };

  // 1. Context diff (as_of, policy version/hash, pack_ref)
  const fromTemporal = from.temporal || {};
  const toTemporal = to.temporal || {};
  const fromPack = from.pack_ref || {};
  const toPack = to.pack_ref || {};
  const fromPolicy = from.input_policies?.[0] || {};
  const toPolicy = to.input_policies?.[0] || {};

  if (fromTemporal.as_of !== toTemporal.as_of) {
    diff.context_diff.as_of = { from: fromTemporal.as_of ?? null, to: toTemporal.as_of ?? null };
  }
  if (fromTemporal.policy_version !== toTemporal.policy_version) {
    diff.context_diff.policy_version = { from: fromTemporal.policy_version ?? null, to: toTemporal.policy_version ?? null };
  }
  if (fromTemporal.policy_hash !== toTemporal.policy_hash) {
    diff.context_diff.policy_hash = { from: fromTemporal.policy_hash ?? null, to: toTemporal.policy_hash ?? null };
  }
  if (stableStringify(fromPack) !== stableStringify(toPack)) {
    diff.context_diff.pack_ref = { from: fromPack, to: toPack };
  }
  if (fromPolicy.path !== toPolicy.path) {
    diff.context_diff.policy_path = { from: fromPolicy.path ?? null, to: toPolicy.path ?? null };
  }

  // 2. Evidence diff (ledger_entry_id, input_policies)
  if (from.ledger_entry_id !== to.ledger_entry_id) {
    diff.evidence_diff.ledger_entry_id = { from: from.ledger_entry_id ?? null, to: to.ledger_entry_id ?? null };
  }
  const fromPolicyKey = stableStringify(fromPolicy);
  const toPolicyKey = stableStringify(toPolicy);
  if (fromPolicyKey !== toPolicyKey) {
    diff.evidence_diff.input_policies = {
      from: from.input_policies || [],
      to: to.input_policies || [],
      changed: true,
    };
  }

  // 3. Checks diff (by id: added, removed, outcome changed)
  const fromChecks = new Map((from.checks || []).map((c) => [c.id, c]));
  const toChecks = new Map((to.checks || []).map((c) => [c.id, c]));
  const allCheckIds = new Set([...fromChecks.keys(), ...toChecks.keys()]);
  diff.checks_diff.added = [];
  diff.checks_diff.removed = [];
  diff.checks_diff.outcome_changed = [];

  for (const id of allCheckIds) {
    const fc = fromChecks.get(id);
    const tc = toChecks.get(id);
    if (!fc && tc) diff.checks_diff.added.push({ id, name: tc.name, outcome: tc.outcome });
    else if (fc && !tc) diff.checks_diff.removed.push({ id, name: fc.name, outcome: fc.outcome });
    else if (fc && tc && fc.outcome !== tc.outcome) {
      diff.checks_diff.outcome_changed.push({
        id,
        name: fc.name || tc.name,
        from: fc.outcome,
        to: tc.outcome,
        reason: tc.reason ?? fc.reason,
      });
    }
  }

  // 4. Rules diff (rules_fired: added, removed)
  const fromRules = (from.rules_fired || []).map((r) => ({ rule_type: r.rule_type, message: r.message }));
  const toRules = (to.rules_fired || []).map((r) => ({ rule_type: r.rule_type, message: r.message }));
  const fromRuleKey = (r) => `${r.rule_type}:${r.message}`;
  const fromRuleSet = new Set(fromRules.map(fromRuleKey));
  const toRuleSet = new Set(toRules.map(fromRuleKey));
  diff.rules_diff.added = toRules.filter((r) => !fromRuleSet.has(fromRuleKey(r)));
  diff.rules_diff.removed = fromRules.filter((r) => !toRuleSet.has(fromRuleKey(r)));

  // 5. Outcome diff
  const fromOverall = get(from, 'outcome.overall', 'unknown');
  const toOverall = get(to, 'outcome.overall', 'unknown');
  const fromSev = get(from, 'outcome.severity_effective');
  const toSev = get(to, 'outcome.severity_effective');
  if (fromOverall !== toOverall) {
    diff.outcome_diff.overall = { from: fromOverall, to: toOverall };
  }
  if (fromSev !== toSev) {
    diff.outcome_diff.severity_effective = { from: fromSev, to: toSev };
  }

  // 6. Why diff
  const fromWhy = get(from, 'outcome.why', '');
  const toWhy = get(to, 'outcome.why', '');
  if (fromWhy !== toWhy) {
    diff.why_diff = { from: fromWhy, to: toWhy };
  }

  // Summary
  const hasChanges =
    Object.keys(diff.context_diff).length > 0 ||
    Object.keys(diff.evidence_diff).length > 0 ||
    diff.checks_diff.added.length > 0 ||
    diff.checks_diff.removed.length > 0 ||
    diff.checks_diff.outcome_changed.length > 0 ||
    diff.rules_diff.added.length > 0 ||
    diff.rules_diff.removed.length > 0 ||
    Object.keys(diff.outcome_diff).length > 0 ||
    Object.keys(diff.why_diff).length > 0;
  diff.summary = hasChanges
    ? `Outcome: ${fromOverall} → ${toOverall}. ${diff.why_diff.to || toWhy}`
    : 'No semantic changes between decisions.';

  return diff;
}

/** Build human-readable Markdown from diff */
function buildDiffMd(diff) {
  const lines = [
    '# Decision Diff',
    '',
    `**From:** \`${diff.from.decision_id}\` (fingerprint: \`${diff.from.fingerprint?.slice(0, 16)}…\`)`,
    `**To:** \`${diff.to.decision_id}\` (fingerprint: \`${diff.to.fingerprint?.slice(0, 16)}…\`)`,
    '',
    `**Summary:** ${diff.summary}`,
    '',
    '---',
    '',
  ];

  if (Object.keys(diff.context_diff).length > 0) {
    lines.push('## Context diff', '');
    for (const [k, v] of Object.entries(diff.context_diff)) {
      const fmt = (x) => {
        if (x == null) return 'n/a';
        if (typeof x === 'object' && x.dir != null) return `${x.pack_id ?? '?'} (${x.dir})`;
        return String(x);
      };
      lines.push(`- **${k}:** \`${fmt(v.from)}\` → \`${fmt(v.to)}\``);
    }
    lines.push('');
  }

  if (Object.keys(diff.evidence_diff).length > 0) {
    lines.push('## Evidence diff', '');
    for (const [k, v] of Object.entries(diff.evidence_diff)) {
      if (k === 'input_policies' && v.changed) {
        lines.push('- **input_policies:** changed');
      } else if (v.from !== undefined && v.to !== undefined) {
        lines.push(`- **${k}:** \`${v.from ?? 'n/a'}\` → \`${v.to ?? 'n/a'}\``);
      }
    }
    lines.push('');
  }

  const checksAdded = diff.checks_diff.added?.length || 0;
  const checksRemoved = diff.checks_diff.removed?.length || 0;
  const checksChanged = diff.checks_diff.outcome_changed?.length || 0;
  if (checksAdded > 0 || checksRemoved > 0 || checksChanged > 0) {
    lines.push('## Checks diff', '');
    if (checksAdded > 0) {
      lines.push('**Added:**', ...diff.checks_diff.added.map((c) => `- ${c.name || c.id} (${c.outcome})`), '');
    }
    if (checksRemoved > 0) {
      lines.push('**Removed:**', ...diff.checks_diff.removed.map((c) => `- ${c.name || c.id} (${c.outcome})`), '');
    }
    if (checksChanged > 0) {
      lines.push(
        '**Outcome changed:**',
        '',
        '| Check | From | To | Reason |',
        '|-------|------|-----|--------|',
        ...diff.checks_diff.outcome_changed.map((c) => `| ${c.name || c.id} | ${c.from} | ${c.to} | ${c.reason ?? '-'} |`),
        ''
      );
    }
  }

  const rulesAdded = diff.rules_diff.added?.length || 0;
  const rulesRemoved = diff.rules_diff.removed?.length || 0;
  if (rulesAdded > 0 || rulesRemoved > 0) {
    lines.push('## Rules diff', '');
    if (rulesRemoved > 0) {
      lines.push('**Removed (no longer fired):**', ...diff.rules_diff.removed.map((r) => `- ${r.rule_type}: ${r.message}`), '');
    }
    if (rulesAdded > 0) {
      lines.push('**Added (newly fired):**', ...diff.rules_diff.added.map((r) => `- ${r.rule_type}: ${r.message}`), '');
    }
  }

  if (Object.keys(diff.outcome_diff).length > 0) {
    lines.push('## Outcome diff', '');
    if (diff.outcome_diff.overall) {
      lines.push(`- **overall:** ${diff.outcome_diff.overall.from} → ${diff.outcome_diff.overall.to}`);
    }
    if (diff.outcome_diff.severity_effective) {
      lines.push(
        `- **severity_effective:** ${diff.outcome_diff.severity_effective.from ?? 'n/a'} → ${diff.outcome_diff.severity_effective.to ?? 'n/a'}`
      );
    }
    lines.push('');
  }

  if (Object.keys(diff.why_diff).length > 0) {
    lines.push('## Why diff', '');
    lines.push('**From:**', `> ${diff.why_diff.from || 'n/a'}`, '');
    lines.push('**To:**', `> ${diff.why_diff.to || 'n/a'}`, '');
  }

  return lines.join('\n');
}

export { computeDiff, buildDiffMd };

function printHelp() {
  console.log(`
Decision Diff — Semantic comparison of two compliance decisions

Usage:
  node decision-diff.mjs --from <path> --to <path>
  node decision-diff.mjs --from decision-A.json --to decision-B.json --format json|md
  node decision-diff.mjs --from A.json --to B.json --output <dir>

Options:
  --from <path>   Path to "from" decision-record.json
  --to <path>    Path to "to" decision-record.json
  --format json|md   Output format (default: both)
  --output <dir>  Write decision-diff.json and decision-diff.md to directory

Output:
  Semantic diff: context, evidence, checks, rules, outcome, why.
  Explains "what changed and why" for regulator/auditor review.
`);
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.length === 0) {
    printHelp();
    process.exit(0);
  }

  const getArg = (name) => {
    const idx = args.indexOf(name);
    return idx >= 0 ? args[idx + 1] : null;
  };

  const fromPath = getArg('--from');
  const toPath = getArg('--to');
  const format = getArg('--format') || 'both';
  const outputDir = getArg('--output');

  if (!fromPath || !toPath) {
    console.error('Required: --from <path> --to <path>');
    process.exit(2);
  }
  if (!existsSync(fromPath)) {
    console.error(`File not found: ${fromPath}`);
    process.exit(2);
  }
  if (!existsSync(toPath)) {
    console.error(`File not found: ${toPath}`);
    process.exit(2);
  }

  const from = safeReadJson(fromPath);
  const to = safeReadJson(toPath);

  const diff = computeDiff(from, to);

  const wantJson = format === 'json' || format === 'both';
  const wantMd = format === 'md' || format === 'both';

  if (outputDir) {
    mkdirSync(outputDir, { recursive: true });
    if (wantJson) {
      const jsonPath = join(outputDir, 'decision-diff.json');
      writeFileSync(jsonPath, JSON.stringify(diff, null, 2), 'utf8');
      console.log(`[decision-diff] ${jsonPath}`);
    }
    if (wantMd) {
      const mdPath = join(outputDir, 'decision-diff.md');
      writeFileSync(mdPath, buildDiffMd(diff), 'utf8');
      console.log(`[decision-diff] ${mdPath}`);
    }
  } else {
    if (wantJson) console.log(JSON.stringify(diff, null, 2));
    else console.log(buildDiffMd(diff));
  }

  console.log('[decision-diff] Done.');
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) main();
