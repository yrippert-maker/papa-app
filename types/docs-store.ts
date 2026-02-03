/**
 * Document Store (Portal storage) — контракты и doc_id.
 * См. docs/plans/MAIL_MVP_SPEC.md, Sprint M1.
 */

export const DOC_CHANGE_PROPOSAL_VERSION = 1;
export const DOC_CHANGE_APPROVAL_VERSION = 1;
export const PAYMENTS_REGISTER_VERSION = 1;

/** Допустимые doc_id. */
export const DOC_IDS = ['finance/payments', 'mura-menasa/handbook'] as const;
export type DocId = (typeof DOC_IDS)[number];

export type DocChangeMode = 'append_json' | 'append_markdown' | 'patch_text';

export interface DocChangePatch {
  append_items?: PaymentsRegisterItem[];
  append_markdown?: string;
  unified_diff?: string;
}

export interface DocChangeProposal {
  version: typeof DOC_CHANGE_PROPOSAL_VERSION;
  proposal_id: string;
  mail_id: string;
  doc_id: DocId;
  mode: DocChangeMode;
  patch: DocChangePatch;
  risk_flags: string[];
  summary: string;
  created_at: string;
  created_by: string;
  status: 'pending' | 'approved' | 'rejected';
}

export type ApplyModeApproval = 'safe_auto' | 'draft_only' | 'manual';

export interface DocChangeApproval {
  version: typeof DOC_CHANGE_APPROVAL_VERSION;
  proposal_id: string;
  mail_id: string;
  operator_id: string;
  decision: 'approve' | 'reject';
  apply_mode?: ApplyModeApproval;
  reason: string | null;
  at: string;
}

/** Одна запись в реестре платежей (append-only). */
export interface PaymentsRegisterItem {
  payment_id: string;
  date: string;
  amount: number;
  currency: string;
  counterparty: string;
  invoice: string | null;
  bank_ref: string | null;
  source_mail_id: string;
  source_message_id?: string;
  evidence?: {
    mail_event_sha256?: string;
    ledger_entry_key?: string;
  };
}

export interface PaymentsRegister {
  version: typeof PAYMENTS_REGISTER_VERSION;
  generated_at: string;
  items: PaymentsRegisterItem[];
}

export interface DocUpdateLedgerEntry {
  version: 1;
  type: 'doc_update';
  doc_id: string;
  proposal_id: string;
  operator_id: string;
  previous_version: string;
  new_version: string;
  hash_before: string;
  hash_after: string;
  at: string;
}

export interface MailEventLedgerEntry {
  version: 1;
  type: 'mail_event';
  mail_id: string;
  sha256: string;
  source: string;
  received_at: string;
}
