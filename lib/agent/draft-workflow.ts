/**
 * AI Agent: Draft → Final state machine.
 * draft → confirmed → final
 */
export type DraftStatus = 'draft' | 'confirmed' | 'final';

export const DRAFT_STATUS: Record<DraftStatus, string> = {
  draft: 'Черновик',
  confirmed: 'Подтверждён',
  final: 'Финальный',
};

export function canTransition(from: DraftStatus, to: DraftStatus): boolean {
  const allowed: Record<DraftStatus, DraftStatus[]> = {
    draft: ['confirmed'],
    confirmed: ['final'],
    final: [],
  };
  return allowed[from]?.includes(to) ?? false;
}
