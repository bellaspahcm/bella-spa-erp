/**
 * @fileoverview Invariant 4: Provenance Completeness
 * 
 * Prevents: B0 Failure #4 (business decision masked - alternatives not explicit)
 * 
 * Rule: INFERENCE requires sources + reasoning.
 *       CANONICAL requires alternatives documented.
 * 
 * @module platform/business-truth/gate/invariants/invariant-4-provenance
 */

import type { BusinessTruthDocument } from '../../types/business-truth';
import type { GateViolation } from '../types';

/**
 * Validate Invariant 4: Provenance Completeness.
 * 
 * @param btd - Business Truth Document
 * @returns Violations found
 */
export function validateInvariant4_ProvenanceCompleteness(
  btd: BusinessTruthDocument
): GateViolation[] {
  const violations: GateViolation[] = [];
  
  for (const truth of btd.truths) {
    // Check: INFERENCE requires sources
    if (truth.epistemicStatus === 'INFERENCE' && truth.provenance.sources.length === 0) {
      violations.push({
        invariant: 'Invariant 4: Provenance Completeness',
        truthId: truth.id,
        severity: 'BLOCKING',
        message: 'INFERENCE requires sources in provenance.',
        evidence: `epistemicStatus=INFERENCE, sources=0, id=${truth.id}`
      });
    }
    
    // Check: INFERENCE requires reasoning
    if (truth.epistemicStatus === 'INFERENCE' && !truth.provenance.reasoning) {
      violations.push({
        invariant: 'Invariant 4: Provenance Completeness',
        truthId: truth.id,
        severity: 'BLOCKING',
        message: 'INFERENCE requires reasoning in provenance.',
        evidence: `epistemicStatus=INFERENCE, reasoning=null, id=${truth.id}`
      });
    }
    
    // Check: Conflicts must be documented
    if (truth.provenance.conflicts.length > 0) {
      for (const conflict of truth.provenance.conflicts) {
        if (!conflict.resolution) {
          violations.push({
            invariant: 'Invariant 4: Provenance Completeness',
            truthId: truth.id,
            severity: 'BLOCKING',
            message: 'Conflict detected but not resolved.',
            evidence: `conflict.nature=${conflict.nature}, id=${truth.id}`
          });
        }
      }
    }
  }
  
  return violations;
}
