/**
 * Mail MVP — очередь писем и решения оператора.
 * Sprint M1: заглушка; далее — чтение/запись в object storage + ledger.
 * См. docs/plans/MAIL_MVP_SPEC.md, MAIL_MVP_SPRINT_M1.md.
 */
import type {
  MailEvent,
  TriageResult,
  OperatorDecision,
  MailStatus,
  TriageCategory,
} from '@/types/mail-mvp';

export interface MailInboxItem {
  mail_id: string;
  source_system: 'gmail' | 'imap';
  mailbox: string;
  received_at: string;
  from: string;
  subject: string;
  status: MailStatus;
  category: TriageCategory | null;
  summary: string | null;
  risk_flags: string[];
  payment_preview: { amount?: number; currency?: string; counterparty?: string } | null;
  proposed_changes_count: number;
}

export interface MailInboxFilters {
  source?: 'gmail' | 'imap';
  category?: TriageCategory;
  risk?: string;
  status?: MailStatus;
  limit?: number;
}

const STUB_ITEMS: MailInboxItem[] = [];

/**
 * Список писем для очереди Portal (inbox).
 */
export function listMailInbox(filters?: MailInboxFilters): MailInboxItem[] {
  let items = [...STUB_ITEMS];
  if (filters?.source) {
    items = items.filter((i) => i.source_system === filters.source);
  }
  if (filters?.category) {
    items = items.filter((i) => i.category === filters.category);
  }
  if (filters?.risk) {
    items = items.filter((i) => i.risk_flags.includes(filters.risk!));
  }
  if (filters?.status) {
    items = items.filter((i) => i.status === filters.status);
  }
  const limit = filters?.limit ?? 50;
  return items.slice(0, limit);
}

/**
 * Детали письма + triage + история решений.
 */
export function getMailDetail(mailId: string): {
  event: MailEvent | null;
  triage: TriageResult | null;
  decisions: OperatorDecision[];
} {
  return {
    event: null,
    triage: null,
    decisions: [],
  };
}

/**
 * Записать решение оператора (Accept / Reject / Escalate / Request info).
 * При Accept передаётся apply_mode: draft | safe_auto | manual.
 */
export function recordOperatorDecision(
  mailId: string,
  opts: {
    operator_id: string;
    decision: OperatorDecision['decision'];
    reason?: string | null;
    apply_mode?: OperatorDecision['apply_mode'];
  }
): void {
  // Stub: в M1 сохранять в БД/object storage и писать в ledger
  void mailId;
  void opts;
}
