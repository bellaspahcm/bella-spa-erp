/**
 * @fileoverview Truth Lifecycle State Machine
 * 
 * Enforces Q0 Invariant #1: Status Lifecycle Enforcement
 * 
 * Prevents shortcuts like INFERENCE → CANONICAL (B0 Failure #1).
 * 
 * @module platform/business-truth/validators/truth-lifecycle
 */

import { TruthStatus, VALID_TRANSITIONS, FORBIDDEN_SHORTCUTS } from '../types/lifecycle';

/**
 * Truth Lifecycle State Machine.
 * 
 * Enforces valid status transitions and blocks forbidden shortcuts.
 */
export class TruthLifecycle {
  /**
   * Check if a status transition is valid.
   * 
   * @param from - Current status
   * @param to - Target status
   * @returns true if transition is allowed, false otherwise
   */
  canTransition(from: TruthStatus, to: TruthStatus): boolean {
    // Check forbidden shortcuts first
    const isForbidden = FORBIDDEN_SHORTCUTS.some(
      ([f, t]) => f === from && t === to
    );
    
    if (isForbidden) {
      return false;
    }
    
    // Check valid transitions
    const validNext = VALID_TRANSITIONS[from] || [];
    return validNext.includes(to);
  }
  
  /**
   * Get required path from current status to CANONICAL.
   * 
   * @param from - Current status
   * @returns Array of statuses that must be passed through
   */
  getRequiredPath(from: TruthStatus): TruthStatus[] {
    const paths: Record<TruthStatus, TruthStatus[]> = {
      'OBSERVED': ['SYNTHESIZED', 'INFERRED', 'PROPOSED', 'CRITIQUED', 'APPROVED', 'CANONICAL'],
      'SYNTHESIZED': ['INFERRED', 'PROPOSED', 'CRITIQUED', 'APPROVED', 'CANONICAL'],
      'INFERRED': ['PROPOSED', 'CRITIQUED', 'APPROVED', 'CANONICAL'],
      'PROPOSED': ['CRITIQUED', 'APPROVED', 'CANONICAL'],
      'CRITIQUED': ['APPROVED', 'CANONICAL'],
      'APPROVED': ['CANONICAL'],
      'CANONICAL': [],
      'VERSIONED': [],
      'SUPERSEDED': []
    };
    
    return paths[from] || [];
  }
  
  /**
   * Validate that a truth can proceed to a target status.
   * 
   * @param currentStatus - Current status
   * @param targetStatus - Desired target status
   * @returns Validation result with error message if invalid
   */
  validateTransition(currentStatus: TruthStatus, targetStatus: TruthStatus): {
    valid: boolean;
    error?: string;
    requiredPath?: TruthStatus[];
  } {
    if (currentStatus === targetStatus) {
      return { valid: true };
    }
    
    const canTransition = this.canTransition(currentStatus, targetStatus);
    
    if (!canTransition) {
      const requiredPath = this.getRequiredPath(currentStatus);
      return {
        valid: false,
        error: `Cannot transition from ${currentStatus} to ${targetStatus}. Required path: ${requiredPath.join(' → ')}`,
        requiredPath
      };
    }
    
    return { valid: true };
  }
  
  /**
   * Check if a status is terminal (no further transitions possible).
   * 
   * @param status - Status to check
   * @returns true if terminal
   */
  isTerminal(status: TruthStatus): boolean {
    return status === 'SUPERSEDED';
  }
  
  /**
   * Check if a status allows modification.
   * 
   * @param status - Status to check
   * @returns true if truth can be modified
   */
  canModify(status: TruthStatus): boolean {
    // Cannot modify once CANONICAL or beyond
    const immutableStatuses: TruthStatus[] = ['CANONICAL', 'VERSIONED', 'SUPERSEDED'];
    return !immutableStatuses.includes(status);
  }
}
