/**
 * @fileoverview Business Truth Confidence & Uncertainty Types
 * 
 * Q0 Contract Dimension 5: Confidence & Uncertainty
 * 
 * Confidence is METADATA about evidence quality, NOT approval authority.
 * Critical distinction to prevent B0 Failure #3.
 * 
 * @module platform/business-truth/types/confidence
 */

/**
 * Confidence metadata for a Business Truth.
 * 
 * IMPORTANT: Confidence score is evidence quality metric,
 * NOT an approval mechanism. High confidence does not equal
 * automatic authorization.
 */
export interface Confidence {
  /**
   * Evidence quality score (0.0 - 1.0).
   * 
   * - 1.0: Perfect evidence (e.g., existing Bella kernel, regulation)
   * - 0.95+: Strong evidence (multiple independent credible sources)
   * - 0.7-0.95: Moderate evidence (single credible source)
   * - <0.7: Weak evidence (anecdotal, assumptions)
   * 
   * Note: Score alone cannot authorize canonicalization.
   */
  score: number;
  
  /**
   * How the confidence score was calculated.
   * 
   * Examples:
   * - "3 independent industry sources"
   * - "Existing verified Bella kernel"
   * - "Single expert opinion"
   * - "Inferred from partial evidence + assumptions"
   */
  basis: string;
  
  /**
   * Explicit assumptions made.
   * 
   * Assumptions reduce confidence and must be documented.
   * 
   * Examples:
   * - "Assumes single-site operation (not multi-site)"
   * - "Assumes US regulatory context"
   * - "Assumes human operators (not automation)"
   */
  assumptions: string[];
}

/**
 * Confidence thresholds for different decision types.
 * 
 * These are guidelines, not automatic authorization.
 * Final decision requires validation + authorization policy.
 */
export const CONFIDENCE_THRESHOLDS = {
  /**
   * High confidence threshold.
   * Required for auto-approval consideration (with other criteria).
   */
  HIGH: 0.95,
  
  /**
   * Moderate confidence threshold.
   * Typically requires human review.
   */
  MODERATE: 0.7,
  
  /**
   * Low confidence threshold.
   * Below this, truth should not proceed without additional research.
   */
  LOW: 0.5,
} as const;
