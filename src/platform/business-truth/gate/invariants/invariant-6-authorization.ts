/**
 * @fileoverview Invariant 6: Factory Build Authorization
 * 
 * Prevents: B0 Failure #6 (factory bypass - E10 not used)
 * 
 * Rule: Only CANONICAL truths can reach E10.
 * 
 * @module platform/business-truth/gate/invariants/invariant-6-authorization
 */

import type { BusinessTruthDocument } from '../../types/business-truth';
import type { GateViolation } from '../types';

/**
 * Validate Invariant 6: Factory Build Authorization.
 * 
 * @param btd - Business Truth Document
 * @returns Violations found
 */
export function validateInvariant6_FactoryAuthorization(
  btd: BusinessTruthDocument
): GateViolation[] {
  const violations: GateViolation[] = [];
  
  // Check: Document approval (only if truths require it)
  // Document approval is applied by Authorization Boundary, not gate
  // Gate validates individual truths
  
  // Check: All truths are CANONICAL
  const nonCanonical = btd.truths.filter(t => t.status !== 'CANONICAL' && t.status !== 'VERSIONED');
  if (nonCanonical.length > 0) {
    violations.push({
      invariant: 'Invariant 6: Factory Authorization',
      truthId: 'DOCUMENT',
      severity: 'BLOCKING',
      message: `${nonCanonical.length} non-CANONICAL truths in document.`,
      evidence: `non-canonical IDs: ${nonCanonical.map(t => t.id).join(', ')}`
    });
  }
  
  return violations;
}
