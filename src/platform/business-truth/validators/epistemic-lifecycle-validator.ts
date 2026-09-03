/**
 * @fileoverview Epistemic-Lifecycle Consistency Validator
 * 
 * Validates consistency between epistemicStatus and status (lifecycle).
 * 
 * Addresses Design Correction Issue #2:
 * - epistemicStatus = HOW was truth known (methodology)
 * - status = WHERE in governance lifecycle (stage)
 * - Both are independent, but certain combinations are invalid
 * 
 * @module platform/business-truth/validators/epistemic-lifecycle-validator
 */

import type { BusinessTruth } from '../types/business-truth';
import type { EpistemicStatus } from '../types/business-truth';
import type { TruthStatus } from '../types/lifecycle';
import type { EvidenceType } from '../types/provenance';

/**
 * Validation error for epistemic-lifecycle inconsistency.
 */
export interface ValidationError {
  message: string;
  truthId: string;
  field: string;
}

/**
 * Epistemic-Lifecycle Consistency Validator.
 * 
 * Enforces cross-field invariants between epistemicStatus and status.
 */
export class EpistemicLifecycleValidator {
  /**
   * Validate epistemic status + lifecycle status consistency.
   * 
   * @param truth - Business truth to validate
   * @returns null if valid, ValidationError if inconsistent
   */
  validate(truth: BusinessTruth): ValidationError | null {
    const { epistemicStatus, status, authority, provenance } = truth;
    
    // Rule 1: INFERENCE + CANONICAL requires approval
    if (epistemicStatus === 'INFERENCE' && status === 'CANONICAL') {
      if (!authority.approvedBy) {
        return {
          message: 'INFERENCE cannot be CANONICAL without approval',
          truthId: truth.id,
          field: 'epistemicStatus + status'
        };
      }
    }
    
    // Rule 2: BELIEF + CANONICAL requires alternatives resolution
    if (epistemicStatus === 'BELIEF' && status === 'CANONICAL') {
      if (provenance.alternatives.length > 0 && authority.approvedBy !== 'HUMAN') {
        return {
          message: 'BELIEF with unresolved alternatives requires HUMAN approval',
          truthId: truth.id,
          field: 'epistemicStatus + status + provenance.alternatives'
        };
      }
    }
    
    // Rule 3: CANONICAL requires APPROVED authority type
    if (status === 'CANONICAL') {
      if (authority.type !== 'APPROVED') {
        return {
          message: 'CANONICAL requires APPROVED authority type',
          truthId: truth.id,
          field: 'status + authority.type'
        };
      }
    }
    
    // Rule 4: KNOWLEDGE can be CANONICAL if from trusted source
    if (epistemicStatus === 'KNOWLEDGE' && status === 'CANONICAL') {
      const trustedSource = 
        authority.source === 'SYSTEM' || // Existing Bella
        provenance.sources.some(s => s.type === 'INDUSTRY_STANDARD' || s.type === 'REGULATORY');
      
      if (!trustedSource && !authority.approvedBy) {
        return {
          message: 'KNOWLEDGE without trusted source requires approval',
          truthId: truth.id,
          field: 'epistemicStatus + provenance.sources + authority'
        };
      }
    }
    
    return null; // Valid
  }
  
  /**
   * Get human-readable explanation of epistemic vs lifecycle semantics.
   * 
   * @returns Explanation string
   */
  explainSemantics(): string {
    return `
epistemicStatus (HOW KNOWN):
  OBSERVATION: Direct evidence, no reasoning
  INFERENCE:   Derived via AI reasoning
  BELIEF:      Uncertain or multiple valid options
  KNOWLEDGE:   Validated, no reasonable doubt

status (GOVERNANCE LIFECYCLE):
  PROPOSED:    Candidate awaiting critique
  CRITIQUED:   Self-examination complete
  APPROVED:    Passed authorization
  CANONICAL:   Final governed truth

Both axes are independent.
Invariants define valid combinations.
    `.trim();
  }
}
