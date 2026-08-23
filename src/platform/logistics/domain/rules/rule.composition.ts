/**
 * Logistics OS — Rule Composition
 * 
 * Mechanism for running multiple rules and aggregating results.
 * 
 * Design Principles:
 * - Composition is a mechanism, not a decision engine
 * - Deterministic evaluation (rule order matters)
 * - No context mutation
 * - Evidence preservation
 * - No workflow execution
 * 
 * Boundary:
 * - E7.3 runs rules and aggregates facts
 * - Product interprets facts and decides workflow
 * 
 * @module logistics/domain/rules/rule.composition
 */

import { Rule, RuleResult, CompositeRuleResult } from './rule.types';

/**
 * Composition Mode
 */
export type CompositionMode =
  | 'ALL'               // Evaluate all rules (default)
  | 'UNTIL_VIOLATION';  // Stop at first violation (short-circuit)

/**
 * Composition Options
 */
export interface CompositionOptions {
  /** Composition mode (default: ALL) */
  mode?: CompositionMode;
  
  /** Continue on rule errors (default: false) */
  continueOnError?: boolean;
}

/**
 * Composition Error
 * 
 * Represents an error during rule evaluation.
 */
export interface RuleEvaluationError {
  ruleId: string;
  version: string;
  error: Error;
  context: any;
}

/**
 * Extended Composite Result
 * 
 * Includes error tracking for robustness.
 */
export interface ExtendedCompositeRuleResult extends CompositeRuleResult {
  /** Evaluation errors (if any) */
  errors: RuleEvaluationError[];
}

/**
 * Compose Rules
 * 
 * Run multiple rules against same context and aggregate results.
 * 
 * Invariants:
 * - #1: Rule order is deterministic (array order)
 * - #2: Same rules + context → same result
 * - #3: No context mutation
 * - #4: No workflow execution
 * - #5: Evidence preservation
 * - #6: Returns facts, not commands
 * - #7: Empty rule set → PASS (no violations)
 * - #8: Rule error → recorded, not silently converted to PASS
 * - #9: Duplicate rule ID/version → all executed in order
 * - #10: Tenant boundary preserved (context unchanged)
 * 
 * @param rules - Rules to evaluate (order matters)
 * @param context - Evaluation context
 * @param options - Composition options
 * @returns Extended composite result
 */
export function composeRules<TContext = any>(
  rules: Rule<TContext>[],
  context: TContext,
  options: CompositionOptions = {}
): ExtendedCompositeRuleResult {
  const { mode = 'ALL', continueOnError = false } = options;
  
  const evaluatedAt = new Date();
  const results: RuleResult[] = [];
  const errors: RuleEvaluationError[] = [];
  
  // Invariant #7: Empty rule set → PASS
  if (rules.length === 0) {
    return {
      status: 'PASS',
      evaluatedAt,
      results: [],
      violations: [],
      evidence: [],
      errors: [],
    };
  }
  
  // Invariant #1: Deterministic order (evaluate in array order)
  for (const rule of rules) {
    try {
      // Invariant #3: Context unchanged (pass by reference but rules must not mutate)
      const result = rule.evaluate(context);
      results.push(result);
      
      // Invariant #8: Short-circuit only in UNTIL_VIOLATION mode
      if (mode === 'UNTIL_VIOLATION' && result.status === 'VIOLATION') {
        break;
      }
    } catch (error) {
      // Invariant #8: Rule error recorded, not silently converted
      const evaluationError: RuleEvaluationError = {
        ruleId: rule.id,
        version: rule.version,
        error: error as Error,
        context,
      };
      errors.push(evaluationError);
      
      if (!continueOnError) {
        // Stop evaluation on error
        break;
      }
    }
  }
  
  // Invariant #5 & #6: Aggregate facts (violations + evidence)
  const violations = results
    .filter(r => r.status === 'VIOLATION')
    .map(r => (r as any).violation);
  
  const evidence = results.map(r => r.evidence);
  
  const status = violations.length > 0 ? 'VIOLATION' : 'PASS';
  
  return {
    status,
    evaluatedAt,
    results,
    violations,
    evidence,
    errors,
  };
}

/**
 * Compose Rules (All Mode)
 * 
 * Convenience function: evaluate all rules.
 * 
 * @param rules - Rules to evaluate
 * @param context - Evaluation context
 * @returns Extended composite result
 */
export function evaluateAll<TContext = any>(
  rules: Rule<TContext>[],
  context: TContext
): ExtendedCompositeRuleResult {
  return composeRules(rules, context, { mode: 'ALL' });
}

/**
 * Compose Rules (Until Violation Mode)
 * 
 * Convenience function: evaluate until first violation.
 * 
 * @param rules - Rules to evaluate
 * @param context - Evaluation context
 * @returns Extended composite result
 */
export function evaluateUntilViolation<TContext = any>(
  rules: Rule<TContext>[],
  context: TContext
): ExtendedCompositeRuleResult {
  return composeRules(rules, context, { mode: 'UNTIL_VIOLATION' });
}

/**
 * Create Composite Rule
 * 
 * Wrap multiple rules into a single Rule interface.
 * 
 * Useful for creating reusable rule sets.
 * 
 * @param id - Composite rule ID
 * @param version - Composite rule version
 * @param description - Composite rule description
 * @param rules - Rules to compose
 * @param options - Composition options
 * @returns Composite rule
 */
export function createCompositeRule<TContext = any>(
  id: string,
  version: string,
  description: string,
  rules: Rule<TContext>[],
  options: CompositionOptions = {}
): Rule<TContext> {
  return {
    id,
    version,
    description,
    evaluate(context: TContext): RuleResult {
      const result = composeRules(rules, context, options);
      
      // Convert ExtendedCompositeRuleResult to RuleResult
      if (result.status === 'PASS') {
        return {
          status: 'PASS',
          ruleId: id,
          version,
          evaluatedAt: result.evaluatedAt,
          evidence: {
            input: { context },
            output: {
              totalRules: rules.length,
              passed: result.results.filter(r => r.status === 'PASS').length,
              violated: result.violations.length,
            },
            metadata: {
              compositeRuleResults: result.results,
              errors: result.errors,
            },
          },
        };
      } else {
        // Return first violation as the composite violation
        const firstViolation = result.violations[0];
        return {
          status: 'VIOLATION',
          ruleId: id,
          version,
          evaluatedAt: result.evaluatedAt,
          violation: {
            code: 'COMPOSITE_RULE_VIOLATION',
            message: `Composite rule failed: ${firstViolation.message}`,
            severity: firstViolation.severity,
            field: firstViolation.field,
            actual: firstViolation.actual,
            expected: firstViolation.expected,
          },
          evidence: {
            input: { context },
            output: {
              totalRules: rules.length,
              passed: result.results.filter(r => r.status === 'PASS').length,
              violated: result.violations.length,
            },
            metadata: {
              compositeRuleResults: result.results,
              violations: result.violations,
              errors: result.errors,
            },
          },
        };
      }
    },
  };
}
