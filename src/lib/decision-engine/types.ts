/**
 * Decision Engine Core Types
 * Ultra-minimal. Production-ready.
 */

// Re-export extended Rule type for providers
export type { Rule } from './rule';

/**
 * Knowledge: Simple key-value dictionary.
 * No abstraction. No interface. Just data.
 */
export type Knowledge = Record<string, unknown>;

/**
 * Decision outcomes (type-safe).
 */
export type DecisionOutcome = 
  | 'APPROVE'
  | 'REJECT'
  | 'ESCALATE';

/**
 * Decision result (pure decision, no telemetry).
 */
export interface DecisionResult {
  outcome: DecisionOutcome;
  explanation?: string;
}

/**
 * Decision rule condition types.
 */
export interface ComparisonCondition {
  type: 'comparison';
  field: string;
  operator: '>=' | '>' | '<=' | '<' | '==' | '===' | '!=' | '!==';
  value: any;
}

export interface OperatorCondition {
  type: 'operator';
  operator: 'and' | 'or';
  conditions: Condition[];
}

export type Condition = ComparisonCondition | OperatorCondition;

/**
 * Decision rule action.
 */
export interface DecisionAction {
  outcome: DecisionOutcome;
  reason: string;
}

/**
 * Decision rule.
 */
export interface DecisionRule {
  id: string;
  priority: number;
  conditions: Condition;
  action: DecisionAction;
}

/**
 * Policy (loaded from PolicyRegistry).
 */
export interface Policy {
  id: string;
  version: string;
  name: string;
  description?: string;
  rules: DecisionRule[];
}
