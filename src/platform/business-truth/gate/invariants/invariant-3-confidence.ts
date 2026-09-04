/**
 * @fileoverview Invariant 3: Confidence ≠ Truth Authority
 * 
 * Prevents: B0 Failure #3 (confidence = truth)
 * 
 * Rule: Confidence is metadata, not approval mechanism.
 * 
 * @module platform/business-truth/gate/invariants/invariant-3-confidence
 */

import type { BusinessTruthDocument } from '../../types/business-truth';
import type { GateViolation } from '../types';

/**
 * Validate Invariant 3: Confidence ≠ Truth Authority.
 * 
 * @param btd - Business Truth Document
 * @returns Violations found
 */
export function validateInvariant3_ConfidenceNotAuthority(
  btd: BusinessTruthDocument
): GateViolation[] {
  const violations: GateViolation[] = [];
  
  for (const truth of btd.truths) {
    // Check: CANONICAL without approval cannot rely only on confidence
    if (
      truth.status === 'CANONICAL' &&
      !truth.authority.approvedBy &&
      truth.confidence.score < 0.95
    ) {
      violations.push({
        invariant: 'Invariant 3: Confidence ≠ Authority',
        truthId: truth.id,
        severity: 'BLOCKING',
        message: 'Confidence alone insufficient for CANONICAL status without approval.',
        evidence: `confidence=${truth.confidence.score}, approvedBy=null, id=${truth.id}`
      });
    }
  }
  
  return violations;
}
