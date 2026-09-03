/**
 * @fileoverview Business Truth Gate Types
 * 
 * Types for gate validation results and authorization decisions.
 * 
 * @module platform/business-truth/gate/types
 */

/**
 * Gate violation severity.
 */
export type ViolationSeverity =
  | 'BLOCKING'  // Prevents canonicalization
  | 'WARNING'   // Advisory, does not block
  | 'INFO';     // Informational

/**
 * Gate violation.
 */
export interface GateViolation {
  invariant: string;
  truthId: string;
  severity: ViolationSeverity;
  message: string;
  evidence: string;
}

/**
 * Authorization status (gate's RECOMMENDATION, not authority itself).
 */
export type AuthorizationStatus =
  | 'AUTO_APPROVED'     // High confidence + no conflicts + no alternatives → system can authorize
  | 'REQUIRES_HUMAN'    // Business decision, conflicts, or low confidence → human must authorize
  | 'BLOCKED';          // Validation failed → cannot proceed

/**
 * Gate validation result.
 * 
 * CRITICAL: Gate validates, does NOT authorize.
 * Authorization is a separate governed decision.
 */
export interface GateResult {
  validated: boolean;              // Invariants passed
  violations: GateViolation[];
  
  // Authorization recommendation (NOT authority itself)
  authorizationStatus: AuthorizationStatus;
  authorizationReason: string;
  
  timestamp: Date;
}
