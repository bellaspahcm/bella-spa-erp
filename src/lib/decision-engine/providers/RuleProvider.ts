/**
 * Decision Engine Platform - RuleProvider
 * 
 * Rule-based decision provider supporting IF-THEN conditional logic.
 * Phase 1 implementation (simple rules).
 * 
 * Supported operators:
 * - Comparison: ==, !=, <, >, <=, >=
 * - String: contains, startsWith, endsWith, matches (regex)
 * - Array: in (value in array)
 * - Logical: and, or, not
 * 
 * @see docs/DECISION_ENGINE_PLATFORM_ARCHITECTURE.md Section 12
 */

import { BaseDecisionProvider } from '../abstractions';
import type { DecisionContext, DecisionResult } from '../types';

/**
 * Comparison operators
 */
type ComparisonOperator = '==' | '!=' | '<' | '>' | '<=' | '>=';

/**
 * String operators
 */
type StringOperator = 'contains' | 'startsWith' | 'endsWith' | 'matches';

/**
 * Array operators
 */
type ArrayOperator = 'in';

/**
 * All supported operators
 */
type Operator = ComparisonOperator | StringOperator | ArrayOperator;

/**
 * Simple condition (field operator value)
 */
interface SimpleCondition {
  field: string;
  operator: Operator;
  value: unknown;
}

/**
 * Logical condition (AND/OR/NOT)
 */
interface LogicalCondition {
  and?: Condition[];
  or?: Condition[];
  not?: Condition;
}

/**
 * Condition (simple or logical)
 */
type Condition = SimpleCondition | LogicalCondition;

/**
 * Rule action
 */
interface RuleAction {
  approve?: boolean;
  [key: string]: unknown;
}

/**
 * IF-THEN rule definition
 */
export interface IfThenRule {
  /** Rule ID (optional, for tracking) */
  id?: string;
  
  /** Rule description (optional) */
  description?: string;
  
  /** Condition to evaluate */
  condition: Condition;
  
  /** Action if condition matches */
  action: RuleAction;
}

/**
 * RuleProvider - Rule-based decision provider
 * 
 * Evaluates IF-THEN conditional rules against input data.
 * 
 * **Supported Rule Types**:
 * - 'if-then': Simple conditional logic
 * - 'decision-table': Table-based rules (future)
 * - 'decision-tree': Hierarchical rules (future)
 * 
 * **Rule Structure**:
 * ```typescript
 * {
 *   condition: {
 *     field: 'amount',
 *     operator: '<',
 *     value: 5000000
 *   },
 *   action: {
 *     approve: true
 *   }
 * }
 * ```
 * 
 * **Complex Conditions** (AND/OR/NOT):
 * ```typescript
 * {
 *   condition: {
 *     and: [
 *       { field: 'amount', operator: '<', value: 10000000 },
 *       { field: 'customerTier', operator: '==', value: 'vip' }
 *     ]
 *   },
 *   action: { approve: true }
 * }
 * ```
 * 
 * @example Basic Usage
 * ```typescript
 * const provider = new RuleProvider();
 * 
 * const context: DecisionContext = {
 *   tenantId: 'bella-spa-vn',
 *   module: 'booking',
 *   decisionType: 'auto-approval',
 *   ruleType: 'if-then',
 *   rule: {
 *     condition: { field: 'amount', operator: '<', value: 5000000 },
 *     action: { approve: true }
 *   },
 *   data: { amount: 3000000 }
 * };
 * 
 * const result = await provider.evaluate(context);
 * // { approved: true, confidence: 1.0, reason: 'Rule matched', ... }
 * ```
 * 
 * @example Complex Condition
 * ```typescript
 * const rule = {
 *   condition: {
 *     or: [
 *       { field: 'amount', operator: '<', value: 5000000 },
 *       {
 *         and: [
 *           { field: 'customerTier', operator: '==', value: 'vip' },
 *           { field: 'amount', operator: '<', value: 10000000 }
 *         ]
 *       }
 *     ]
 *   },
 *   action: { approve: true }
 * };
 * ```
 */
export class RuleProvider extends BaseDecisionProvider {
  constructor() {
    super('RuleProvider', ['if-then', 'decision-table', 'decision-tree']);
  }

  /**
   * Evaluate decision based on rule
   * 
   * @param context - Decision context with rule and data
   * @returns DecisionResult
   */
  async evaluate(context: DecisionContext): Promise<DecisionResult> {
    const startTime = Date.now();

    try {
      // Parse rule
      const rule = this.parseRule(context.rule);

      // Evaluate condition
      const matched = this.evaluateCondition(rule.condition, context.data);

      // Build result
      const result = this.createSuccessResult(matched, 1.0, {
        reason: this.buildReason(rule, matched),
        matchedRules: matched && rule.id ? [rule.id] : undefined,
        action: matched ? { type: 'rule-action', data: rule.action } : { type: 'no-action', data: {} },
        metadata: {
          rule: {
            id: rule.id,
            description: rule.description,
          },
          evaluatedCondition: rule.condition,
          inputData: context.data,
        },
      });

      // Set execution time
      result.executionTime = Date.now() - startTime;

      return result;
    } catch (error) {
      return this.createErrorResult(error as Error, Date.now() - startTime);
    }
  }

  /**
   * Parse rule from context
   * @private
   */
  private parseRule(ruleDefinition: unknown): IfThenRule {
    const rule = ruleDefinition as IfThenRule;

    // Validate rule structure
    if (!rule || typeof rule !== 'object') {
      throw new Error('Rule must be an object');
    }

    if (!rule.condition) {
      throw new Error('Rule must have a condition');
    }

    if (!rule.action) {
      throw new Error('Rule must have an action');
    }

    return rule;
  }

  /**
   * Evaluate condition (recursive for logical conditions)
   * @private
   */
  private evaluateCondition(
    condition: Condition,
    data: Record<string, unknown>
  ): boolean {
    // Logical condition (AND/OR/NOT)
    if ('and' in condition || 'or' in condition || 'not' in condition) {
      return this.evaluateLogicalCondition(
        condition as LogicalCondition,
        data
      );
    }

    // Simple condition (field operator value)
    return this.evaluateSimpleCondition(condition as SimpleCondition, data);
  }

  /**
   * Evaluate logical condition (AND/OR/NOT)
   * @private
   */
  private evaluateLogicalCondition(
    condition: LogicalCondition,
    data: Record<string, unknown>
  ): boolean {
    // AND: all conditions must be true
    if (condition.and) {
      return condition.and.every((c) => this.evaluateCondition(c, data));
    }

    // OR: at least one condition must be true
    if (condition.or) {
      return condition.or.some((c) => this.evaluateCondition(c, data));
    }

    // NOT: condition must be false
    if (condition.not) {
      return !this.evaluateCondition(condition.not, data);
    }

    throw new Error('Invalid logical condition: must have and, or, or not');
  }

  /**
   * Evaluate simple condition (field operator value)
   * @private
   */
  private evaluateSimpleCondition(
    condition: SimpleCondition,
    data: Record<string, unknown>
  ): boolean {
    const { field, operator, value } = condition;

    // Get field value from data
    const fieldValue = this.extractFieldValue(field, data);

    // Evaluate based on operator
    switch (operator) {
      // Comparison operators
      case '==':
        return fieldValue === value;
      case '!=':
        return fieldValue !== value;
      case '<':
        return (fieldValue as number) < (value as number);
      case '>':
        return (fieldValue as number) > (value as number);
      case '<=':
        return (fieldValue as number) <= (value as number);
      case '>=':
        return (fieldValue as number) >= (value as number);

      // String operators
      case 'contains':
        return String(fieldValue).includes(String(value));
      case 'startsWith':
        return String(fieldValue).startsWith(String(value));
      case 'endsWith':
        return String(fieldValue).endsWith(String(value));
      case 'matches':
        return new RegExp(String(value)).test(String(fieldValue));

      // Array operators
      case 'in':
        return Array.isArray(value) && value.includes(fieldValue);

      default:
        throw new Error(`Unsupported operator: ${operator}`);
    }
  }

  /**
   * Get field value from data (supports nested fields with dot notation)
   * 
   * @example
   * ```typescript
   * extractFieldValue('amount', { amount: 5000000 }) // 5000000
   * extractFieldValue('customer.tier', { customer: { tier: 'vip' } }) // 'vip'
   * ```
   * 
   * @private
   */
  private extractFieldValue(
    field: string,
    data: Record<string, unknown>
  ): unknown {
    // Support dot notation (e.g., 'customer.tier')
    const parts = field.split('.');
    let value: any = data;

    for (const part of parts) {
      if (value === null || value === undefined) {
        return undefined;
      }
      value = value[part];
    }

    return value;
  }

  /**
   * Build reason message
   * @private
   */
  private buildReason(rule: IfThenRule, matched: boolean): string {
    if (rule.description) {
      return matched
        ? `Rule matched: ${rule.description}`
        : `Rule not matched: ${rule.description}`;
    }

    return matched
      ? 'Rule condition matched'
      : 'Rule condition not matched';
  }
}
