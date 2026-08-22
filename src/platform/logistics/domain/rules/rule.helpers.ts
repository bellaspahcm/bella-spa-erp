/**
 * Logistics OS — Rule Helpers
 * 
 * Helper functions for creating rule results.
 * 
 * @module logistics/domain/rules
 */

import type {
  RulePass,
  RuleViolation,
  ViolationDetail,
  RuleEvidence,
} from './rule.types';

/**
 * Create a PASS result
 * 
 * @param ruleId - Rule identifier
 * @param version - Rule version
 * @param evidence - Evaluation evidence
 * @param evaluatedAt - Evaluation timestamp (default: now)
 * @returns RulePass
 */
export function pass(
  ruleId: string,
  version: string,
  evidence: RuleEvidence,
  evaluatedAt: Date = new Date()
): RulePass {
  return {
    status: 'PASS',
    ruleId,
    version,
    evaluatedAt,
    evidence,
  };
}

/**
 * Create a VIOLATION result
 * 
 * @param ruleId - Rule identifier
 * @param version - Rule version
 * @param violation - Violation detail
 * @param evidence - Evaluation evidence
 * @param evaluatedAt - Evaluation timestamp (default: now)
 * @returns RuleViolation
 */
export function violation(
  ruleId: string,
  version: string,
  violation: ViolationDetail,
  evidence: RuleEvidence,
  evaluatedAt: Date = new Date()
): RuleViolation {
  return {
    status: 'VIOLATION',
    ruleId,
    version,
    evaluatedAt,
    violation,
    evidence,
  };
}

/**
 * Create violation detail
 * 
 * @param code - Violation code
 * @param message - Human-readable message
 * @param severity - Violation severity (default: ERROR)
 * @param options - Additional options
 * @returns ViolationDetail
 */
export function createViolation(
  code: string,
  message: string,
  severity: 'ERROR' | 'WARNING' = 'ERROR',
  options?: {
    field?: string;
    actual?: any;
    expected?: any;
  }
): ViolationDetail {
  return {
    code,
    message,
    severity,
    field: options?.field,
    actual: options?.actual,
    expected: options?.expected,
  };
}

/**
 * Create rule evidence
 * 
 * @param input - Input context
 * @param output - Evaluation output
 * @param metadata - Additional metadata
 * @returns RuleEvidence
 */
export function createEvidence(
  input: Record<string, any>,
  output: any,
  metadata?: Record<string, any>
): RuleEvidence {
  return {
    input,
    output,
    metadata,
  };
}
