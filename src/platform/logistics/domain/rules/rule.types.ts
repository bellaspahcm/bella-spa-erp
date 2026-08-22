/**
 * Logistics OS — Rule Domain Types
 * 
 * Generic rule evaluation contract for E7.3 Rules & Traceability.
 * 
 * Design Principles:
 * - Rules evaluate constraints, do not execute workflows
 * - Rules are deterministic (same input → same output)
 * - Rules are side-effect-free (no mutations)
 * - Rules return facts (data), not commands (actions)
 * 
 * @module logistics/domain/rules
 */

/**
 * Rule Interface
 * 
 * Generic contract for evaluating business rules.
 * 
 * @template TContext - Input context for rule evaluation
 */
export interface Rule<TContext> {
  /** Unique rule identifier (machine-readable) */
  readonly id: string;
  
  /** Rule version (semantic versioning) */
  readonly version: string;
  
  /** Human-readable description */
  readonly description: string;
  
  /**
   * Evaluate rule against context
   * 
   * MUST be deterministic: same context → same result
   * MUST be side-effect-free: no mutations, no external calls
   * 
   * @param context - Evaluation context
   * @returns RuleResult (PASS or VIOLATION)
   */
  evaluate(context: TContext): RuleResult;
}

/**
 * Rule Result
 * 
 * Outcome of rule evaluation (data, not command).
 */
export type RuleResult = RulePass | RuleViolation;

/**
 * Rule Pass
 * 
 * Rule evaluation succeeded (constraint satisfied).
 */
export interface RulePass {
  status: 'PASS';
  ruleId: string;
  version: string;
  evaluatedAt: Date;
  evidence: RuleEvidence;
}

/**
 * Rule Violation
 * 
 * Rule evaluation failed (constraint violated).
 */
export interface RuleViolation {
  status: 'VIOLATION';
  ruleId: string;
  version: string;
  evaluatedAt: Date;
  violation: ViolationDetail;
  evidence: RuleEvidence;
}

/**
 * Violation Detail
 * 
 * Structured information about rule violation.
 */
export interface ViolationDetail {
  /** Machine-readable violation code */
  code: string;
  
  /** Human-readable message */
  message: string;
  
  /** Violation severity */
  severity: 'ERROR' | 'WARNING';
  
  /** Field that violated (optional) */
  field?: string;
  
  /** Actual value that violated */
  actual?: any;
  
  /** Expected value */
  expected?: any;
}

/**
 * Rule Evidence
 * 
 * Audit trail for rule evaluation (compliance/debugging).
 */
export interface RuleEvidence {
  /** Input context (for reproducibility) */
  input: Record<string, any>;
  
  /** Evaluation output/result */
  output: any;
  
  /** Additional metadata (optional) */
  metadata?: Record<string, any>;
}

/**
 * Composite Rule Result
 * 
 * Result of evaluating multiple rules.
 */
export interface CompositeRuleResult {
  status: 'PASS' | 'VIOLATION';
  evaluatedAt: Date;
  results: RuleResult[];
  violations: ViolationDetail[];
  evidence: RuleEvidence[];
}

/**
 * Generic Violation Codes
 * 
 * Machine-readable codes for E7.3 generic rules.
 */
export const RuleViolationCodes = {
  // Expiry
  INVENTORY_EXPIRED: 'INVENTORY_EXPIRED',
  
  // Quantity
  QUANTITY_MUST_BE_POSITIVE: 'QUANTITY_MUST_BE_POSITIVE',
  INSUFFICIENT_AVAILABLE_QUANTITY: 'INSUFFICIENT_AVAILABLE_QUANTITY',
  INSUFFICIENT_RESERVED_QUANTITY: 'INSUFFICIENT_RESERVED_QUANTITY',
  
  // Traceability
  LOT_NUMBER_REQUIRED: 'LOT_NUMBER_REQUIRED',
  SERIAL_NUMBER_REQUIRED: 'SERIAL_NUMBER_REQUIRED',
  BROKEN_TRACEABILITY_CHAIN: 'BROKEN_TRACEABILITY_CHAIN',
  
  // Compliance
  COMPLIANCE_VIOLATION: 'COMPLIANCE_VIOLATION',
} as const;

/**
 * Rule Violation Code Type
 */
export type RuleViolationCode = typeof RuleViolationCodes[keyof typeof RuleViolationCodes];
