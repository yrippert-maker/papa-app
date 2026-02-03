/**
 * Anchoring issues API types — structured issues for ops/QA.
 */

export type AnchoringIssueSeverity = 'major' | 'critical';

export type AnchoringIssueType =
  | 'ANCHOR_FAILED'
  | 'ANCHOR_PENDING_TOO_LONG'
  | 'RECEIPT_MISSING_FOR_CONFIRMED'
  | 'RECEIPT_INTEGRITY_MISMATCH'
  | 'GAP_IN_PERIODS';

export interface AnchoringIssue {
  id: string;
  type: AnchoringIssueType;
  severity: AnchoringIssueSeverity;
  periodStart?: string;
  periodEnd?: string;
  anchorId?: string;
  txHash?: string;
  message: string;
  actionHref: string;
  /** Runbook link (e.g. docs/runbooks/anchoring/receipt-mismatch.md) */
  runbookHref?: string;
  /** Short suggested action for ops */
  suggestedAction?: string;
  /** Stable fingerprint for dedupe/ack (same as independent-verify) */
  _fingerprint?: string;
}

export interface AnchoringIssuesResponse {
  windowDays: number;
  generatedAt: string;
  issues: AnchoringIssue[];
}
