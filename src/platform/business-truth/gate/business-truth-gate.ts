/**
 * @fileoverview Business Truth Gate - Main Orchestrator
 * 
 * Orchestrates all 7 Q0 invariant validations and produces gate result.
 * 
 * CRITICAL: Gate validates, does NOT authorize.
 * Authorization is a separate governed decision.
 * 
 * @module platform/business-truth/gate/business-truth-gate
 */

import type { BusinessTruthDocument } from '../types/business-truth';
import type { GateResult, GateViolation, AuthorizationStatus } from './types';

// Import all 7 invariants
import { validateInvariant1_StatusLifecycle } from './invariants/invariant-1-lifecycle';
import { validateInvariant2_AuthorityStatus } from './invariants/invariant-2-authority';
import { validateInvariant3_ConfidenceNotAuthority } from './invariants/invariant-3-confidence';
import { validateInvariant4_ProvenanceCompleteness } from './invariants/invariant-4-provenance';
import { validateInvariant5_ImplementationFeasibility } from './invariants/invariant-5-implementation';
import { validateInvariant6_FactoryAuthorization } from './invariants/invariant-6-authorization';
import { validateInvariant7_VerificationTraceability } from './invariants/invariant-7-verification';

/**
 * Business Truth Gate.
 * 
 * Entry point for validating Business Truth Documents before E10 consumption.
 */
export class BusinessTruthGate {
  /**
   * Validate Business Truth Document through all 7 invariants.
   * 
   * @param btd - Business Truth Document to validate
   * @returns Gate result with violations and authorization recommendation
   */
  validate(btd: BusinessTruthDocument): GateResult {
    const violations: GateViolation[] = [];
    
    // Run all 7 invariants
    violations.push(...validateInvariant1_StatusLifecycle(btd));
    violations.push(...validateInvariant2_AuthorityStatus(btd));
    violations.push(...validateInvariant3_ConfidenceNotAuthority(btd));
    violations.push(...validateInvariant4_ProvenanceCompleteness(btd));
    violations.push(...validateInvariant5_ImplementationFeasibility(btd));
    violations.push(...validateInvariant6_FactoryAuthorization(btd));
    violations.push(...validateInvariant7_VerificationTraceability(btd));
    
    // Check if any BLOCKING violations
    const blockingViolations = violations.filter(v => v.severity === 'BLOCKING');
    const validated = blockingViolations.length === 0;
    
    // Determine authorization recommendation
    const { status, reason } = this.determineAuthorizationStatus(btd, violations, validated);
    
    return {
      validated,
      violations,
      authorizationStatus: status,
      authorizationReason: reason,
      timestamp: new Date()
    };
  }
  
  /**
   * Determine authorization recommendation (NOT authority itself).
   * 
   * @param btd - Business Truth Document
   * @param violations - All violations found
   * @param validated - Whether validation passed
   * @returns Authorization status and reason
   */
  private determineAuthorizationStatus(
    btd: BusinessTruthDocument,
    violations: GateViolation[],
    validated: boolean
  ): { status: AuthorizationStatus; reason: string } {
    // If validation failed, BLOCKED
    if (!validated) {
      return {
        status: 'BLOCKED',
        reason: `${violations.filter(v => v.severity === 'BLOCKING').length} blocking violations found.`
      };
    }
    
    // Check if any truth requires human approval
    const requiresHuman = btd.truths.some(truth => {
      // Business decisions (alternatives exist) require human
      if (truth.provenance.alternatives.length > 0) {
        return true;
      }
      
      // Unresolved conflicts require human
      if (truth.provenance.conflicts.some(c => !c.resolution)) {
        return true;
      }
      
      // Low confidence requires human
      if (truth.confidence.score < 0.95) {
        return true;
      }
      
      return false;
    });
    
    if (requiresHuman) {
      return {
        status: 'REQUIRES_HUMAN',
        reason: 'Document contains business decisions, conflicts, or low confidence truths requiring human review.'
      };
    }
    
    // All truths are high confidence, no conflicts, no alternatives
    return {
      status: 'AUTO_APPROVED',
      reason: 'All truths are high confidence, no conflicts, no unresolved alternatives. Eligible for auto-approval.'
    };
  }
}
