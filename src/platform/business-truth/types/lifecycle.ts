/**
 * @fileoverview Business Truth Lifecycle Status Types
 * 
 * Q0 Contract Dimension 6: Status Lifecycle
 * 
 * Defines the governance lifecycle stages a Business Truth passes through
 * from initial evidence collection to final canonical truth.
 * 
 * @module platform/business-truth/types/lifecycle
 */

/**
 * Truth status in governance lifecycle.
 * 
 * This represents WHERE in the governance process a truth is,
 * independent of HOW it was discovered (see EpistemicStatus).
 */
export type TruthStatus =
  | 'OBSERVED'      // Raw evidence collected
  | 'SYNTHESIZED'   // Evidence combined
  | 'INFERRED'      // Reasoning applied
  | 'PROPOSED'      // Candidate formed (E11 output)
  | 'CRITIQUED'     // Self-critique completed
  | 'APPROVED'      // Passed approval criteria
  | 'CANONICAL'     // Final governed truth (E10 input)
  | 'VERSIONED'     // Timestamped immutable version
  | 'SUPERSEDED';   // Replaced by newer version

/**
 * Valid status transitions.
 * 
 * Enforces governance lifecycle - shortcuts are forbidden.
 */
export const VALID_TRANSITIONS: Record<TruthStatus, TruthStatus[]> = {
  'OBSERVED': ['SYNTHESIZED'],
  'SYNTHESIZED': ['INFERRED'],
  'INFERRED': ['PROPOSED'],
  'PROPOSED': ['CRITIQUED'],
  'CRITIQUED': ['APPROVED', 'PROPOSED'], // Can return to PROPOSED if critique fails
  'APPROVED': ['CANONICAL'],
  'CANONICAL': ['VERSIONED'],
  'VERSIONED': ['SUPERSEDED'],
  'SUPERSEDED': [] // Terminal state
};

/**
 * Forbidden shortcuts (explicitly blocked).
 * 
 * These transitions violate governance and must be prevented.
 * Corresponds to B0 Failure #1 and related shortcuts.
 */
export const FORBIDDEN_SHORTCUTS: Array<[TruthStatus, TruthStatus]> = [
  ['INFERRED', 'CANONICAL'],      // B0 Failure #1
  ['PROPOSED', 'CANONICAL'],      // Skip critique + approval
  ['OBSERVED', 'CANONICAL'],      // Skip all governance
  ['SYNTHESIZED', 'CANONICAL'],   // Skip governance
  ['INFERRED', 'APPROVED'],       // Skip proposal + critique
  ['PROPOSED', 'APPROVED']        // Skip critique (must go through CRITIQUED)
];
