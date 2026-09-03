/**
 * @fileoverview Confidence Validator
 * 
 * Validates confidence metadata and enforces Q0 Invariant #3:
 * Confidence ≠ Truth Authority
 * 
 * @module platform/business-truth/validators/confidence-validator
 */

import type { Confidence } from '../types/confidence';
import { CONFIDENCE_THRESHOLDS } from '../types/confidence';

/**
 * Confidence validation result.
 */
export interface ConfidenceValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Confidence Validator.
 * 
 * Validates confidence metadata and prevents misuse as authority.
 */
export class ConfidenceValidator {
  /**
   * Validate confidence structure and values.
   * 
   * @param confidence - Confidence to validate
   * @returns Validation result
   */
  validate(confidence: Confidence): ConfidenceValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Score must be 0.0 - 1.0
    if (confidence.score < 0 || confidence.score > 1) {
      errors.push(`Confidence score must be 0.0-1.0, got ${confidence.score}`);
    }
    
    // Basis must be provided
    if (!confidence.basis || confidence.basis.trim().length === 0) {
      errors.push('Confidence basis must be provided');
    }
    
    // Warn on low confidence
    if (confidence.score < CONFIDENCE_THRESHOLDS.LOW) {
      warnings.push(`Very low confidence (${confidence.score}). Consider additional research.`);
    }
    
    // Warn on many assumptions
    if (confidence.assumptions.length > 3) {
      warnings.push(`High assumption count (${confidence.assumptions.length}). Verify assumptions.`);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Check if confidence meets auto-approval threshold.
   * 
   * NOTE: This is a NECESSARY but NOT SUFFICIENT condition.
   * Other criteria (no conflicts, no alternatives) must also be met.
   * 
   * @param confidence - Confidence to check
   * @returns true if threshold met
   */
  meetsAutoApprovalThreshold(confidence: Confidence): boolean {
    return confidence.score >= CONFIDENCE_THRESHOLDS.HIGH;
  }
  
  /**
   * Get confidence level classification.
   * 
   * @param score - Confidence score
   * @returns Classification
   */
  classify(score: number): 'HIGH' | 'MODERATE' | 'LOW' {
    if (score >= CONFIDENCE_THRESHOLDS.HIGH) return 'HIGH';
    if (score >= CONFIDENCE_THRESHOLDS.MODERATE) return 'MODERATE';
    return 'LOW';
  }
}
