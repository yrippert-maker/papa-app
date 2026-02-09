'use client';

export type StatusBadgeVariant = 'success' | 'warning' | 'error' | 'neutral' | 'info';

const VARIANT_CLASSES: Record<StatusBadgeVariant, string> = {
  success: 'badge-success',
  warning: 'badge-warning',
  error: 'badge-error',
  neutral: 'badge-secondary',
  info: 'badge-primary',
};

/** Map common status strings to variants */
const STATUS_TO_VARIANT: Record<string, StatusBadgeVariant> = {
  ok: 'success',
  active: 'success',
  success: 'success',
  completed: 'success',
  approved: 'success',
  due_soon: 'warning',
  pending: 'warning',
  warning: 'warning',
  overdue: 'error',
  error: 'error',
  failed: 'error',
  inactive: 'neutral',
  draft: 'neutral',
  info: 'info',
};

export type StatusBadgeProps = {
  status: string;
  variant?: StatusBadgeVariant;
  /** Custom label (default: status) */
  label?: string;
};

/**
 * Replaces 57+ inline bg-green-100/bg-red-100/bg-yellow-100 styles.
 * Maps status → color via STATUS_TO_VARIANT or explicit variant.
 */
export function StatusBadge({ status, variant, label }: StatusBadgeProps) {
  const v = variant ?? STATUS_TO_VARIANT[status.toLowerCase()] ?? 'neutral';
  const cls = VARIANT_CLASSES[v];
  return <span className={`badge ${cls}`}>{label ?? status}</span>;
}
