/**
 * @fileoverview Authority Model State Machine
 * 
 * Enforces Q0 Invariant #2: Authority-Status Consistency
 * 
 * Prevents AI self-approval of inferences (B0 Failure #2).
 * 
 * @module platform/business-truth/validators/authority-model
 */

import type { AuthoritySource, AuthorityType, Authority } from '../types/authority';

/**
 * Authority Model State Machine.
 * 
 * Defines valid authority transitions and approval rules.
 */
export class AuthorityModel {
  /**
   * Check if authority transition is valid.
   * 
   * @param from - Current authority state
   * @param to - Target authority state
   * @returns true if transition is allowed
   */
  canTransition(
    from: { source: AuthoritySource; type: AuthorityType },
    to: { source: AuthoritySource; type: AuthorityType }
  ): boolean {
    // AI can DERIVE from existing system
    if (to.source === 'AI' && to.type === 'DERIVED') {
      return from.source === 'SYSTEM';
    }
    
    // AI can INFER from evidence
    if (to.source === 'AI' && to.type === 'INFERRED') {
      return true; // Always allowed (AI reasoning)
    }
    
    // AI can PROPOSE candidates
    if (to.source === 'AI' && to.type === 'PROPOSED') {
      return from.type === 'INFERRED' || from.type === 'DERIVED';
    }
    
    // HUMAN can DECIDE
    if (to.source === 'HUMAN' && to.type === 'DECIDED') {
      return from.type === 'PROPOSED';
    }
    
    // HUMAN can APPROVE
    if (to.source === 'HUMAN' && to.type === 'APPROVED') {
      return from.type === 'PROPOSED' || from.type === 'DECIDED';
    }
    
    // AI can auto-APPROVE under conditions
    if (to.source === 'AI' && to.type === 'APPROVED') {
      // Only from PROPOSED
      // Conditions checked by BusinessTruthGate
      return from.type === 'PROPOSED';
    }
    
    // SYSTEM can DERIVE from existing Bella
    if (to.source === 'SYSTEM' && to.type === 'DERIVED') {
      return true; // Always allowed (extracting from existing code)
    }
    
    return false;
  }
  
  /**
   * Validate authority transition.
   * 
   * @param currentAuthority - Current authority
   * @param targetAuthority - Target authority
   * @returns Validation result
   */
  validateTransition(
    currentAuthority: Authority,
    targetAuthority: { source: AuthoritySource; type: AuthorityType }
  ): { valid: boolean; error?: string } {
    const from = { source: currentAuthority.source, type: currentAuthority.type };
    const to = targetAuthority;
    
    const canTransition = this.canTransition(from, to);
    
    if (!canTransition) {
      return {
        valid: false,
        error: `Cannot transition authority from ${from.source}:${from.type} to ${to.source}:${to.type}`
      };
    }
    
    return { valid: true };
  }
}
