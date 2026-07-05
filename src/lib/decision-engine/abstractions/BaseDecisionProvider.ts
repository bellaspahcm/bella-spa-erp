/**
 * Decision Engine Platform - BaseDecisionProvider
 * 
 * Base abstract class for all Decision Providers.
 * Provides common functionality and helper methods.
 * 
 * @see docs/DECISION_ENGINE_PLATFORM_ARCHITECTURE.md Section 6
 */

import type { IDecisionProvider } from './IDecisionProvider';
import type { DecisionContext, DecisionResult, DecisionAction } from '../types';

/**
 * Base abstract class for Decision Providers
 * 
 * Provides common functionality for all providers:
 * - Default canHandle() implementation
 * - Helper methods for creating results
 * - Standardized error handling
 * 
 * Providers should extend this class instead of implementing IDecisionProvider directly.
 * 
 * @example
 * ```typescript
 * class RuleProvider extends BaseDecisionProvider {
 *   constructor() {
 *     super('RuleProvider', ['if-then', 'decision-table']);
 *   }
 * 
 *   async evaluate(context: DecisionContext): Promise<DecisionResult> {
 *     const rule = context.rule as IfThenRule;
 *     const matched = this.evaluateRule(rule, context.data);
 *     
 *     return this.createSuccessResult(matched, 1.0, {
 *       reason: matched ? 'Rule matched' : 'Rule not matched',
 *       matchedRules: matched ? [rule.id] : [],
 *     });
 *   }
 * }
 * ```
 */
export abstract class BaseDecisionProvider implements IDecisionProvider {
  /**
   * Create a new provider
   * 
   * @param name - Provider name (must be unique)
   * @param supportedRuleTypes - Rule types this provider supports
   */
  constructor(
    public readonly name: string,
    public readonly supportedRuleTypes: string[]
  ) {
    if (!name || name.trim().length === 0) {
      throw new Error('Provider name is required');
    }
    if (!supportedRuleTypes || supportedRuleTypes.length === 0) {
      throw new Error('Provider must support at least one rule type');
    }
  }

  /**
   * Evaluate decision (must be implemented by subclass)
   * 
   * Subclasses must implement this method with provider-specific logic.
   * 
   * @param context - Decision context
   * @returns Promise<DecisionResult> - Decision result
   */
  abstract evaluate(context: DecisionContext): Promise<DecisionResult>;

  /**
   * Default canHandle implementation
   * 
   * Checks if context.ruleType is in supportedRuleTypes.
   * Subclasses can override for custom validation.
   * 
   * @param context - Decision context to validate
   * @returns boolean - True if provider can handle this context
   */
  canHandle(context: DecisionContext): boolean {
    return this.supportedRuleTypes.includes(context.ruleType);
  }

  /**
   * Helper: Create success result
   * 
   * @param approved - Whether decision is approved
   * @param confidence - Confidence level (0.0 - 1.0)
   * @param options - Optional result metadata
   * @returns DecisionResult
   * 
   * @protected
   * 
   * @example
   * ```typescript
   * return this.createSuccessResult(true, 0.95, {
   *   reason: 'Rule matched with high confidence',
   *   matchedRules: ['rule-1', 'rule-2'],
   *   metadata: { score: 95 },
   * });
   * ```
   */
  protected createSuccessResult(
    approved: boolean,
    confidence: number,
    options: {
      reason?: string;
      matchedRules?: string[];
      metadata?: Record<string, unknown>;
      action?: DecisionAction;
    } = {}
  ): DecisionResult {
    return {
      approved,
      confidence: Math.max(0, Math.min(1, confidence)), // Clamp to [0, 1]
      reason: options.reason,
      matchedRules: options.matchedRules,
      metadata: options.metadata,
      action: options.action,
      executionTime: 0, // Filled by Engine
      provider: this.name,
      timestamp: new Date(),
    };
  }

  /**
   * Helper: Create error result
   * 
   * @param error - Error object
   * @param executionTime - Execution time in milliseconds
   * @returns DecisionResult with error information
   * 
   * @protected
   * 
   * @example
   * ```typescript
   * try {
   *   // ... provider logic
   * } catch (error) {
   *   return this.createErrorResult(error as Error, Date.now() - startTime);
   * }
   * ```
   */
  protected createErrorResult(
    error: Error,
    executionTime: number
  ): DecisionResult {
    return {
      approved: false,
      confidence: 0.0,
      reason: `Provider evaluation failed: ${error.message}`,
      error: {
        message: error.message,
        code: error.name || 'PROVIDER_ERROR',
        stack: error.stack,
      },
      executionTime,
      provider: this.name,
      timestamp: new Date(),
    };
  }

  /**
   * Helper: Validate required fields in context data
   * 
   * @param context - Decision context
   * @param requiredFields - Array of required field names
   * @throws Error if any required field is missing
   * 
   * @protected
   * 
   * @example
   * ```typescript
   * evaluate(context: DecisionContext): Promise<DecisionResult> {
   *   this.validateRequiredFields(context, ['totalAmount', 'customerTier']);
   *   // ... rest of evaluation
   * }
   * ```
   */
  protected validateRequiredFields(
    context: DecisionContext,
    requiredFields: string[]
  ): void {
    const missingFields = requiredFields.filter(
      field => !(field in (context.data || {}))
    );
    
    if (missingFields.length > 0) {
      throw new Error(
        `Missing required fields in context.data: ${missingFields.join(', ')}`
      );
    }
  }

  /**
   * Helper: Extract field value from context data with default
   * 
   * @param context - Decision context
   * @param field - Field name
   * @param defaultValue - Default value if field is missing
   * @returns Field value or default
   * 
   * @protected
   * 
   * @example
   * ```typescript
   * const amount = this.getFieldValue(context, 'totalAmount', 0);
   * const tier = this.getFieldValue(context, 'customerTier', 'new');
   * ```
   */
  protected getFieldValue<T>(
    context: DecisionContext,
    field: string,
    defaultValue: T
  ): T {
    const value = context.data?.[field];
    return value !== undefined && value !== null ? (value as T) : defaultValue;
  }
}
