/**
 * Compliance Inbox Service
 * Change events, patch proposals, accept/reject/apply flow.
 */
import { getDb, dbGet, dbAll, dbRun } from './db';
import { randomUUID } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

export type ChangeEventSeverity = 'info' | 'minor' | 'major' | 'critical';
export type ChangeEventStatus = 'NEW' | 'ACCEPTED' | 'PROPOSED' | 'APPLIED' | 'REJECTED';

export interface ChangeEvent {
  id: string;
  source: string;
  title: string;
  published_at: string | null;
  url: string | null;
  artifact_sha256: string | null;
  summary: string | null;
  severity: ChangeEventSeverity;
  tags: string | null;
  fulltext_path: string | null;
  diff_summary: string | null;
  status: ChangeEventStatus;
  created_at: string;
  updated_at: string;
}

export interface PatchTarget {
  document_id: string;
  section_locator: string;
  operation: 'insert' | 'replace' | 'append' | 'update_reference';
  before_excerpt?: string;
  after_text: string;
}

export interface PatchProposal {
  id: string;
  change_event_id: string;
  apply_mode: 'auto' | 'minors_only' | 'manual';
  status: 'proposed' | 'applied' | 'superseded';
  targets_json: string;
  created_at: string;
  applied_at: string | null;
  applied_by: string | null;
}

function loadDocumentMap(): { root_path: string; documents: Array<{ id: string; path: string }> } {
  const mapPath = join(process.cwd(), 'config', 'ai-agent', 'document-map.json');
  const raw = readFileSync(mapPath, 'utf-8');
  const map = JSON.parse(raw) as { root_path: string; documents: Array<{ id: string; path: string }> };
  return map;
}

export async function listInbox(opts?: { status?: ChangeEventStatus; limit?: number }): Promise<ChangeEvent[]> {
  const db = await getDb();
  const limit = opts?.limit ?? 50;
  let sql = 'SELECT * FROM compliance_change_event ORDER BY created_at DESC LIMIT ?';
  const params: (string | number)[] = [limit];
  if (opts?.status) {
    sql = 'SELECT * FROM compliance_change_event WHERE status = ? ORDER BY created_at DESC LIMIT ?';
    params.unshift(opts.status);
  }
  const rows = (await dbAll(db, sql, ...params)) as ChangeEvent[];
  return rows;
}

export async function getInboxItem(id: string): Promise<ChangeEvent | null> {
  const db = await getDb();
  const row = (await dbGet(db, 'SELECT * FROM compliance_change_event WHERE id = ?', id)) as ChangeEvent | undefined;
  return row ?? null;
}

export async function getProposalByEventId(changeEventId: string): Promise<PatchProposal | null> {
  const db = await getDb();
  const row = (await dbGet(db, 'SELECT * FROM compliance_patch_proposal WHERE change_event_id = ? AND status = ?', changeEventId, 'proposed')) as PatchProposal | undefined;
  return row ?? null;
}

export async function getProposal(id: string): Promise<PatchProposal | null> {
  const db = await getDb();
  const row = (await dbGet(db, 'SELECT * FROM compliance_patch_proposal WHERE id = ?', id)) as PatchProposal | undefined;
  return row ?? null;
}

export async function acceptChangeEvent(
  changeEventId: string,
  opts: { actor_user_id?: string; actor_role?: string; comment?: string; targets?: PatchTarget[] }
): Promise<{ proposal_id: string }> {
  const db = await getDb();
  const event = await getInboxItem(changeEventId);
  if (!event) throw new Error('Change event not found');
  if (event.status !== 'NEW') throw new Error('Event already processed');

  const proposalId = `prop-${randomUUID().slice(0, 8)}`;
  const targets = opts.targets ?? [];
  const targetsJson = JSON.stringify(targets);

  await dbRun(db, 'INSERT INTO compliance_patch_proposal (id, change_event_id, apply_mode, status, targets_json) VALUES (?, ?, ?, ?, ?)', proposalId, changeEventId, 'manual', 'proposed', targetsJson);

  await dbRun(db, 'INSERT INTO compliance_decision_log (change_event_id, action, actor_user_id, actor_role, comment) VALUES (?, ?, ?, ?, ?)', changeEventId, 'accept', opts.actor_user_id ?? null, opts.actor_role ?? null, opts.comment ?? null);

  await dbRun(db, "UPDATE compliance_change_event SET status = ?, updated_at = datetime('now') WHERE id = ?", 'PROPOSED', changeEventId);

  return { proposal_id: proposalId };
}

export async function rejectChangeEvent(
  changeEventId: string,
  opts: { actor_user_id?: string; actor_role?: string; comment?: string }
): Promise<void> {
  const db = await getDb();
  const event = await getInboxItem(changeEventId);
  if (!event) throw new Error('Change event not found');
  if (event.status !== 'NEW') throw new Error('Event already processed');

  await dbRun(db, 'INSERT INTO compliance_decision_log (change_event_id, action, actor_user_id, actor_role, comment) VALUES (?, ?, ?, ?, ?)', changeEventId, 'reject', opts.actor_user_id ?? null, opts.actor_role ?? null, opts.comment ?? null);

  await dbRun(db, "UPDATE compliance_change_event SET status = ?, updated_at = datetime('now') WHERE id = ?", 'REJECTED', changeEventId);

  try {
    const { appendAnchoredEvent } = await import('./ledger-anchoring-service');
    await appendAnchoredEvent({
      event_type: 'DOC_REJECTED',
      payload: { change_event_id: changeEventId },
      actor_id: opts.actor_user_id ?? undefined,
      artifact_sha256: event.artifact_sha256 ?? undefined,
    });
  } catch (e) {
    console.warn('[compliance] Ledger anchoring skipped:', e instanceof Error ? e.message : e);
  }
}

/**
 * Apply patch proposal. Creates revision records.
 * DOCX patching: stub — логируем, но реальное редактирование DOCX требует docx-библиотеки.
 */
export async function applyProposal(
  proposalId: string,
  opts: { applied_by?: string }
): Promise<{ applied: boolean; message: string }> {
  const db = await getDb();
  const proposal = await getProposal(proposalId);
  if (!proposal) throw new Error('Proposal not found');
  if (proposal.status !== 'proposed') throw new Error('Proposal already applied or superseded');

  const event = await getInboxItem(proposal.change_event_id);
  if (!event) throw new Error('Change event not found');

  const map = loadDocumentMap();
  const docsRoot = join(process.cwd(), map.root_path);
  const targets = JSON.parse(proposal.targets_json) as PatchTarget[];

  for (const t of targets) {
    const doc = map.documents.find((d) => d.id === t.document_id);
    if (!doc) continue;
    const docPath = join(docsRoot, doc.path);
    if (!existsSync(docPath)) continue;

    const revId = `rev-${randomUUID().slice(0, 8)}`;
    const beforeContent = readFileSync(docPath);
    const beforeSha = createHash('sha256').update(beforeContent).digest('hex');

    // Stub: реальное редактирование DOCX требует docx-библиотеки (mammoth, docx, etc.)
    // Пока создаём revision с before_sha256; after будет при реальной реализации
    await dbRun(db, 'INSERT INTO compliance_revision (id, proposal_id, document_id, section_id, before_sha256, before_path) VALUES (?, ?, ?, ?, ?, ?)', revId, proposalId, t.document_id, t.section_locator, beforeSha, doc.path);
  }

  await dbRun(db, "UPDATE compliance_patch_proposal SET status = ?, applied_at = datetime('now'), applied_by = ? WHERE id = ?", 'applied', opts.applied_by ?? null, proposalId);

  await dbRun(db, "UPDATE compliance_change_event SET status = ?, updated_at = datetime('now') WHERE id = ?", 'APPLIED', proposal.change_event_id);

  try {
    const { appendAnchoredEvent } = await import('./ledger-anchoring-service');
    await appendAnchoredEvent({
      event_type: 'PATCH_APPLIED',
      payload: { proposal_id: proposalId, change_event_id: proposal.change_event_id, targets_count: targets.length },
      actor_id: opts.applied_by ?? undefined,
      artifact_sha256: event.artifact_sha256 ?? undefined,
    });
  } catch (e) {
    console.warn('[compliance] Ledger anchoring skipped:', e instanceof Error ? e.message : e);
  }

  return {
    applied: true,
    message: 'Proposal applied (revision records created). DOCX patching requires docx library — manual edit recommended.',
  };
}

export async function createTestChangeEvent(): Promise<ChangeEvent> {
  const id = `ce-${randomUUID().slice(0, 8)}`;
  const db = await getDb();
  await dbRun(db, `INSERT INTO compliance_change_event (id, source, title, summary, severity, tags, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    'TEST',
    'Test change event (monitor:run)',
    'Stub event for pipeline verification',
    'info',
    JSON.stringify(['quality', 'test']),
    'NEW'
  );
  return (await getInboxItem(id))!;
}

export async function getMonitorStatus(): Promise<{ last_run: string | null; new_count: number }> {
  const db = await getDb();
  const row = (await dbGet(db, "SELECT MAX(created_at) as last_run, COUNT(*) as new_count FROM compliance_change_event WHERE status = 'NEW'")) as { last_run: string | null; new_count: number };
  return { last_run: row?.last_run ?? null, new_count: (row?.new_count as number) ?? 0 };
}
