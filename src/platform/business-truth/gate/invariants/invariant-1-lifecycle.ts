/**
 * @fileoverview Invariant 1: Status Lifecycle Enforcement
 * 
 * Prevents: B0 Failure #1 (INFERENCE → CANONICAL shortcut)
 * 
 * Rule: INFERENCE cannot become CANONICAL without approval.
 * Required path: OBSERVED/INFERRED → PROPOSED → CRITIQUED → APPROVED → CANONICAL
 * 
 * @module platform/business-truth/gate/invariants/invariant-1-lifecycle
 */

import type { BusinessTruthDocument } from '../../types/business-truth';
import type { GateViolation } from '../types';

/**
 * Validate Invariant 1: Status Lifecycle Enforcement.
 * 
 * @param btd - Business Truth Document
 * @returns Violations found
 */
export function validateInvariant1_StatusLifecycle(
  btd: BusinessTruthDocument
): GateViolation[] {
  const violations: GateViolation[] = [];
  
  for (const truth of btd.truths) {
    // Check: No non-CANONICAL truths in document
    if (truth.status !== 'CANONICAL' && truth.status !== 'VERSIONED') {
      violations.push({
        invariant: 'Invariant 1: Status Lifecycle',
        truthId: truth.id,
        severity: 'BLOCKING',
        message: `Truth status is ${truth.status}, not CANONICAL. Cannot proceed to E10.`,
        evidence: `status=${truth.status}, id=${truth.id}`
      });
    }
    
    // Check: INFERENCE + CANONICAL is FORBIDDEN
    if (truth.epistemicStatus === 'INFERENCE' && truth.status === 'CANONICAL') {
      violations.push({
        invariant: 'Invariant 1: Status Lifecycle',
        truthId: truth.id,
        severity: 'BLOCKING',
        message: 'INFERENCE cannot be CANONICAL without going through PROPOSED → APPROVED.',
        evidence: `epistemicStatus=INFERENCE, status=CANONICAL, id=${truth.id}`
      });
    }
  }
  
  return violations;
}
