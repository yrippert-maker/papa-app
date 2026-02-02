/**
 * Inspection card state machine (v0.1.10).
 * Defines valid transitions and immutability rules.
 */

export type InspectionCardStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

type Transition = {
  from: InspectionCardStatus;
  to: InspectionCardStatus;
};

/**
 * Valid state transitions:
 * DRAFT → IN_PROGRESS → COMPLETED
 *       ↘ CANCELLED
 * IN_PROGRESS → CANCELLED
 */
const VALID_TRANSITIONS: Transition[] = [
  { from: 'DRAFT', to: 'IN_PROGRESS' },
  { from: 'DRAFT', to: 'CANCELLED' },
  { from: 'IN_PROGRESS', to: 'COMPLETED' },
  { from: 'IN_PROGRESS', to: 'CANCELLED' },
];

/**
 * Returns true if transition from → to is valid.
 */
export function isValidTransition(from: InspectionCardStatus, to: InspectionCardStatus): boolean {
  return VALID_TRANSITIONS.some((t) => t.from === from && t.to === to);
}

/**
 * Returns true if card status is immutable (COMPLETED).
 * COMPLETED cards cannot be modified or transitioned.
 */
export function isImmutable(status: InspectionCardStatus): boolean {
  return status === 'COMPLETED';
}

/**
 * Returns true if check results can be written (DRAFT or IN_PROGRESS).
 * COMPLETED and CANCELLED are terminal — no writes.
 */
export function canWriteCheckResults(status: InspectionCardStatus): boolean {
  return status === 'DRAFT' || status === 'IN_PROGRESS';
}

/**
 * Validates transition request. Throws error if invalid.
 */
export function validateTransition(
  currentStatus: InspectionCardStatus,
  targetStatus: InspectionCardStatus
): void {
  if (isImmutable(currentStatus)) {
    throw new Error(`Card is ${currentStatus} and cannot be modified`);
  }
  if (!isValidTransition(currentStatus, targetStatus)) {
    throw new Error(`Invalid transition: ${currentStatus} → ${targetStatus}`);
  }
}
