/**
 * @fileoverview Invariant 2: Authority-Status Consistency
 * 
 * Prevents: B0 Failure #2 (approvedBy: AI invalid)
 *           B0 Failure #4 (business decision masked)
 * 
 * Rule: AI cannot self-approve inferences as CANONICAL.
 *       Business decisions require HUMAN authority.
 * 
 * @module platform/business-truth/gate/invariants/invariant-2-authority
 */

import type { BusinessTruthDocument } from '../../types/business-truth';
import type { GateViolation } from '../types';

/**
 * Validate Invariant 2: Authority-Status Consistency.
 * 
 * @param btd - Business Truth Document
 * @returns Violations found
 */
export function validateInvariant2_AuthorityStatus(
  btd: BusinessTruthDocument
): GateViolation[] {
  const violations: GateViolation[] = [];
  
  for (const truth of btd.truths) {
    // Check: INFERENCE + CANONICAL + AI approval is FORBIDDEN
    if (
      truth.epistemicStatus === 'INFERENCE' &&
      truth.status === 'CANONICAL' &&
      truth.authority.approvedBy === 'AI'
    ) {
      violations.push({
        invariant: 'Invariant 2: Authority-Status Consistency',
        truthId: truth.id,
        severity: 'BLOCKING',
        message: 'AI cannot approve INFERENCE as CANONICAL.',
        evidence: `epistemicStatus=INFERENCE, status=CANONICAL, approvedBy=AI, id=${truth.id}`
      });
    }
    
    // Check: CANONICAL requires approval
    if (truth.status === 'CANONICAL' && !truth.authority.approvedBy) {
      // Exception: High confidence + no conflicts + no alternatives
      const canAutoApprove =
        truth.confidence.score >= 0.95 &&
        truth.provenance.conflicts.length === 0 &&
        truth.provenance.alternatives.length === 0;
      
      if (!canAutoApprove) {
        violations.push({
          invariant: 'Invariant 2: Authority-Status Consistency',
          truthId: truth.id,
          severity: 'BLOCKING',
          message: 'CANONICAL requires approval (human or high-confidence auto-approve).',
          evidence: `status=CANONICAL, approvedBy=null, confidence=${truth.confidence.score}, id=${truth.id}`
        });
      }
    }
    
    // Check: Business decisions (alternatives exist) require HUMAN
    if (
      truth.provenance.alternatives.length > 0 &&
      truth.status === 'CANONICAL' &&
      truth.authority.approvedBy !== 'HUMAN'
    ) {
      violations.push({
        invariant: 'Invariant 2: Authority-Status Consistency',
        truthId: truth.id,
        severity: 'BLOCKING',
        message: 'Business decisions with alternatives require HUMAN approval.',
        evidence: `alternatives=${truth.provenance.alternatives.length}, approvedBy=${truth.authority.approvedBy}, id=${truth.id}`
      });
    }
  }
  
  return violations;
}
