/**
 * @fileoverview Invariant 5: Implementation Feasibility
 * 
 * Prevents: B0 Failure #5 (technical hallucination during E10 implementation)
 * 
 * Rule: When E10 implements Business Truth, it must use existing Bella patterns
 *       (not invent abstractions like DatabaseService).
 * 
 * NOTE: This validates implementation GUIDANCE, not business truth validity.
 *       Business Truth is industry-agnostic. Bella evidence is advisory for E10.
 * 
 * @module platform/business-truth/gate/invariants/invariant-5-implementation
 */

import type { BusinessTruthDocument } from '../../types/business-truth';
import type { GateViolation } from '../types';

/**
 * Validate Invariant 5: Implementation Feasibility.
 * 
 * @param btd - Business Truth Document
 * @returns Violations found
 */
export function validateInvariant5_ImplementationFeasibility(
  btd: BusinessTruthDocument
): GateViolation[] {
  const violations: GateViolation[] = [];
  
  for (const truth of btd.truths) {
    // Check: If Bella implementation evidence exists, flag for E10 reuse
    const bellaEvidence = truth.provenance.sources.filter(
      s => s.type === 'BELLA_KERNEL' || s.type === 'BELLA_PATTERN'
    );
    
    if (bellaEvidence.length > 0) {
      // Advisory: E10 should reuse these patterns
      violations.push({
        invariant: 'Invariant 5: Implementation Feasibility',
        truthId: truth.id,
        severity: 'INFO', // NOT BLOCKING - advisory only
        message: `Bella patterns available for reuse: ${bellaEvidence.map(e => e.source).join(', ')}`,
        evidence: `Bella evidence count: ${bellaEvidence.length}`
      });
    } else if (truth.authority.source === 'AI' && (truth.contentType === 'ENTITY' || truth.contentType === 'PROCESS')) {
      // Warning: No Bella pattern found, E10 will generate new
      violations.push({
        invariant: 'Invariant 5: Implementation Feasibility',
        truthId: truth.id,
        severity: 'WARNING', // NOT BLOCKING - new patterns are valid
        message: 'No Bella pattern found. E10 will generate new implementation. Verify post-build.',
        evidence: `contentType=${truth.contentType}, no Bella evidence`
      });
    }
  }
  
  return violations;
}
