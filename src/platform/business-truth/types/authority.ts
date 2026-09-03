/**
 * @fileoverview Business Truth Authority & Approval Types
 * 
 * Q0 Contract Dimension 3: Authority & Approval (WHO DECIDED)
 * 
 * Defines authority sources, types, and approval mechanisms.
 * Critical for preventing AI self-approval (B0 Failure #2).
 * 
 * @module platform/business-truth/types/authority
 */

/**
 * Source of authority.
 */
export type AuthoritySource =
  | 'SYSTEM'   // Derived from existing Bella code/schema
  | 'AI'       // Inferred by AI reasoning
  | 'HUMAN';   // Decided by human expert/stakeholder

/**
 * Type of authority action.
 */
export type AuthorityType =
  | 'DERIVED'   // From existing system evidence
  | 'INFERRED'  // From AI reasoning
  | 'PROPOSED'  // Candidate awaiting approval
  | 'DECIDED'   // Business decision made
  | 'APPROVED'; // Passed approval gate

/**
 * Who/what approved the truth.
 */
export type ApprovalAuthority =
  | 'AI'     // Auto-approved (high confidence + no conflicts + no alternatives)
  | 'HUMAN'  // Human-approved
  | 'SYSTEM'; // System-validated (existing Bella pattern)

/**
 * Authority metadata for a Business Truth.
 */
export interface Authority {
  source: AuthoritySource;
  type: AuthorityType;
  approvedBy: ApprovalAuthority | null;
  approvedAt: Date | null;
}

/**
 * Valid authority transitions.
 * Defines which authority state changes are allowed.
 */
export const VALID_AUTHORITY_TRANSITIONS: Array<{
  from: { source: AuthoritySource; type: AuthorityType };
  to: { source: AuthoritySource; type: AuthorityType };
  allowed: boolean;
}> = [
  // AI can DERIVE from existing system
  { from: { source: 'SYSTEM', type: 'DERIVED' }, to: { source: 'AI', type: 'DERIVED' }, allowed: true },
  
  // AI can INFER from evidence
  { from: { source: 'AI', type: 'DERIVED' }, to: { source: 'AI', type: 'INFERRED' }, allowed: true },
  { from: { source: 'SYSTEM', type: 'DERIVED' }, to: { source: 'AI', type: 'INFERRED' }, allowed: true },
  
  // AI can PROPOSE candidates
  { from: { source: 'AI', type: 'INFERRED' }, to: { source: 'AI', type: 'PROPOSED' }, allowed: true },
  { from: { source: 'AI', type: 'DERIVED' }, to: { source: 'AI', type: 'PROPOSED' }, allowed: true },
  
  // HUMAN can DECIDE
  { from: { source: 'AI', type: 'PROPOSED' }, to: { source: 'HUMAN', type: 'DECIDED' }, allowed: true },
  
  // HUMAN can APPROVE
  { from: { source: 'AI', type: 'PROPOSED' }, to: { source: 'HUMAN', type: 'APPROVED' }, allowed: true },
  { from: { source: 'HUMAN', type: 'DECIDED' }, to: { source: 'HUMAN', type: 'APPROVED' }, allowed: true },
  
  // AI can auto-APPROVE under conditions (checked by gate)
  { from: { source: 'AI', type: 'PROPOSED' }, to: { source: 'AI', type: 'APPROVED' }, allowed: true },
  
  // SYSTEM can DERIVE from existing Bella
  { from: { source: 'SYSTEM', type: 'DERIVED' }, to: { source: 'SYSTEM', type: 'DERIVED' }, allowed: true },
];
