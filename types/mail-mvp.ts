/**
 * Mail MVP — data contracts (см. docs/plans/MAIL_MVP_SPEC.md секция C).
 */

export const MAIL_EVENT_VERSION = 1;
export const TRIAGE_RESULT_VERSION = 1;
export const OPERATOR_DECISION_VERSION = 1;

export type MailSourceSystem = 'gmail' | 'imap';

export interface MailEventSource {
  system: MailSourceSystem;
  mailbox: string;
  uid: string;
}

export interface MailEventAttachment {
  filename: string;
  mime: string;
  size: number;
  sha256: string;
}

export interface MailEventIntegrity {
  sha256_normalized: string;
}

/** Best-effort SPF/DKIM/DMARC from Authentication-Results header. */
export interface MailAuthIndicators {
  spf?: 'pass' | 'fail' | 'neutral' | 'none';
  dkim?: 'pass' | 'fail' | 'none';
  dmarc?: 'pass' | 'fail' | 'none';
  raw?: string;
}

/** 0–100; derived from DKIM/SPF/DMARC (e.g. all pass → low, any fail → high). */
export type MailRiskScore = number;

/** Best-effort virus scan result (hook placeholder). */
export interface MailVirusScanResult {
  scanned_at: string; // ISO8601
  result: 'clean' | 'infected' | 'unknown' | 'skipped';
  engine?: string;
  details?: string;
}

export interface MailEvent {
  version: typeof MAIL_EVENT_VERSION;
  mail_id: string;
  source: MailEventSource;
  message_id: string;
  thread_id?: string;
  received_at: string; // ISO8601
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  /** Stable key for dedupe (e.g. sha256(source|mailbox|message_id|received_at)). */
  idempotency_key?: string;
  auth_indicators?: MailAuthIndicators;
  /** 0–100 from DKIM/SPF/DMARC; higher = riskier. */
  risk_score?: MailRiskScore;
  /** ISO8601; mail without decision after this time → SLA warning. */
  sla_warning_at?: string;
  /** Best-effort virus scan (optional hook). */
  virus_scan?: MailVirusScanResult;
  body_text: string;
  attachments: MailEventAttachment[];
  integrity: MailEventIntegrity;
}

export type TriageCategory = 'finance_payment' | 'doc_mura_menasa' | 'other';

export interface PaymentEntities {
  amount: number;
  currency: string;
  date: string; // YYYY-MM-DD
  counterparty: string;
  invoice: string | null;
  bank_ref: string | null;
}

export interface TriageEntities {
  payment?: PaymentEntities;
}

export interface ProposedChange {
  target: 'finance_payments_register' | 'mura_menasa_doc';
  mode: 'append' | 'patch';
  patch: string; // unified diff or structured patch
  explanation: string;
}

export interface TriageResult {
  version: typeof TRIAGE_RESULT_VERSION;
  mail_id: string;
  category: TriageCategory;
  confidence: number;
  summary: string;
  risk_flags: string[];
  entities: TriageEntities;
  suggested_operator: string;
  proposed_changes: ProposedChange[];
}

export type OperatorDecisionType = 'accept' | 'reject' | 'escalate' | 'request_info';
export type ApplyMode = 'draft' | 'safe_auto' | 'manual';

export interface OperatorDecision {
  version: typeof OPERATOR_DECISION_VERSION;
  mail_id: string;
  operator_id: string;
  decision: OperatorDecisionType;
  reason: string | null;
  apply_mode?: ApplyMode;
  at: string; // ISO8601
}

export type MailStatus = 'new' | 'accepted' | 'rejected' | 'escalated' | 'request_info';
