/**
 * Decision Engine Platform - IDecisionProvider Interface
 * 
 * Core abstraction for all decision providers.
 * All providers (Rule, BI, AI, External, Manual, Composite) implement this interface.
 * 
 * @see docs/DECISION_ENGINE_PLATFORM_ARCHITECTURE.md Section 6 & 12
 */

import type { DecisionContext, DecisionResult } from '../types';

/**
 * IDecisionProvider - Provider abstraction interface
 * 
 * All decision providers must implement this interface. The Decision Engine uses
 * this interface to delegate decision evaluation to providers in a uniform way.
 * 
 * Design Principles:
 * 1. Providers are pluggable (register via DI container)
 * 2. Providers are replaceable (swap without Engine changes)
 * 3. Providers have full autonomy (internal logic is opaque to Engine)
 * 4. Providers return standardized DecisionResult
 * 5. Engine doesn't know provider internals
 * 
 * @example Simple Provider Implementation
 * ```typescript
 * class RuleProvider implements IDecisionProvider {
 *   readonly name = 'RuleProvider';
 *   readonly supportedRuleTypes = ['if-then', 'decision-table'];
 * 
 *   async evaluate(context: DecisionContext): Promise<DecisionResult> {
 *     const rule = this.parseRule(context.rule);
 *     const matched = this.evaluateRule(rule, context.data);
 *     
 *     return {
 *       approved: matched,
 *       confidence: 1.0,
 *       reason: matched ? 'Rule matched' : 'Rule not matched',
 *       matchedRules: matched ? [rule.id] : [],
 *       executionTime: 0, // Filled by Engine
 *       provider: this.name,
 *       timestamp: new Date()
 *     };
 *   }
 * 
 *   canHandle(context: DecisionContext): boolean {
 *     return this.supportedRuleTypes.includes(context.ruleType);
 *   }
 * }
 * ```
 * 
 * @example Advanced Provider with Data Access
 * ```typescript
 * class BIProvider implements IDecisionProvider {
 *   readonly name = 'BIProvider';
 *   readonly supportedRuleTypes = ['bi-query', 'sql-query'];
 * 
 *   constructor(private readonly biClient: IBIClient) {}
 * 
 *   async evaluate(context: DecisionContext): Promise<DecisionResult> {
 *     // Provider may access external services
 *     const query = context.rule as BIQuery;
 *     const result = await this.biClient.execute(query);
 *     
 *     return {
 *       approved: result.value > query.threshold,
 *       confidence: 0.9, // BI results have some uncertainty
 *       reason: `BI metric: ${result.value} (threshold: ${query.threshold})`,
 *       metadata: { biResult: result },
 *       executionTime: 0,
 *       provider: this.name,
 *       timestamp: new Date()
 *     };
 *   }
 * 
 *   canHandle(context: DecisionContext): boolean {
 *     return this.supportedRuleTypes.includes(context.ruleType);
 *   }
 * }
 * ```
 */
export interface IDecisionProvider {
  /**
   * Provider name (used for logging, metrics, and identification)
   * 
   * Must be unique across all registered providers.
   * 
   * @example 'RuleProvider', 'BIProvider', 'AIProvider'
   */
  readonly name: string;

  /**
   * Rule types this provider supports
   * 
   * The Decision Engine uses this to select the appropriate provider
   * based on DecisionContext.ruleType.
   * 
   * Multiple providers can support the same rule type (first registered wins).
   * 
   * @example
   * ```typescript
   * ['if-then', 'decision-table', 'decision-tree'] // RuleProvider
   * ['bi-query', 'sql-query', 'dashboard-metric'] // BIProvider
   * ['ml-model', 'ai-prediction', 'neural-network'] // AIProvider
   * ```
   */
  readonly supportedRuleTypes: string[];

  /**
   * Evaluate decision based on context
   * 
   * This is the core method where provider logic executes. Providers have
   * full autonomy in how they make decisions:
   * - RuleProvider: Evaluate if-then rules
   * - BIProvider: Query BI dashboards/data warehouse
   * - AIProvider: Call ML models
   * - ExternalProvider: Call 3rd-party APIs
   * - ManualProvider: Trigger human review workflow
   * - CompositeProvider: Chain multiple providers
   * 
   * **Requirements**:
   * 1. Must return standardized DecisionResult
   * 2. executionTime will be filled by Engine (provider can set to 0)
   * 3. Must not throw errors (catch and return error result or re-throw for Engine to handle)
   * 4. Should complete within timeout (default: 5000ms)
   * 
   * **Provider Autonomy**:
   * - Provider MAY access database (for rule definitions, BI queries)
   * - Provider MAY call external APIs
   * - Provider MAY cache internally (rules, query results, models)
   * - Provider MAY use its own error handling
   * - Provider MUST NOT call other business modules
   * - Provider MUST NOT manage workflows
   * 
   * @param context - Decision context with all input data
   * @returns Promise<DecisionResult> - Standardized decision result
   * @throws Error - If evaluation fails catastrophically (Engine will catch and handle)
   * 
   * @example
   * ```typescript
   * async evaluate(context: DecisionContext): Promise<DecisionResult> {
   *   const startTime = Date.now();
   *   
   *   try {
   *     // Provider-specific logic
   *     const rule = await this.loadRule(context.rule);
   *     const matched = this.evaluateConditions(rule, context.data);
   *     
   *     return {
   *       approved: matched,
   *       confidence: 1.0,
   *       reason: this.buildReason(rule, matched),
   *       matchedRules: matched ? [rule.id] : [],
   *       executionTime: Date.now() - startTime,
   *       provider: this.name,
   *       timestamp: new Date()
   *     };
   *   } catch (error) {
   *     // Provider can handle errors internally or re-throw
   *     return {
   *       approved: false,
   *       confidence: 0.0,
   *       reason: `Evaluation failed: ${error.message}`,
   *       error: {
   *         message: error.message,
   *         code: 'PROVIDER_EVALUATION_ERROR'
   *       },
   *       executionTime: Date.now() - startTime,
   *       provider: this.name,
   *       timestamp: new Date()
   *     };
   *   }
   * }
   * ```
   */
  evaluate(context: DecisionContext): Promise<DecisionResult>;

  /**
   * Validate if this provider can handle the context
   * 
   * Optional method for pre-validation before evaluation.
   * Engine uses this for provider selection verification.
   * 
   * Default implementation checks if context.ruleType is in supportedRuleTypes.
   * 
   * Providers can override for more sophisticated checks:
   * - Validate rule structure
   * - Check required data fields
   * - Verify external service availability
   * 
   * @param context - Decision context to validate
   * @returns boolean - True if provider can handle this context
   * 
   * @example
   * ```typescript
   * canHandle(context: DecisionContext): boolean {
   *   // Check rule type
   *   if (!this.supportedRuleTypes.includes(context.ruleType)) {
   *     return false;
   *   }
   *   
   *   // Additional validation
   *   const rule = context.rule as IfThenRule;
   *   if (!rule.condition || !rule.action) {
   *     return false; // Invalid rule structure
   *   }
   *   
   *   return true;
   * }
   * ```
   */
  canHandle(context: DecisionContext): boolean;
}

/**
 * Base abstract class for Decision Providers
 * 
 * Provides common functionality for all providers.
 * Providers can extend this class instead of implementing IDecisionProvider directly.
 * 
 * @example
 * ```typescript
 * class RuleProvider extends BaseDecisionProvider {
 *   constructor() {
 *     super('RuleProvider', ['if-then', 'decision-table']);
 *   }
 * 
 *   async evaluate(context: DecisionContext): Promise<DecisionResult> {
 *     // Implementation
 *   }
 * }
 * ```
 */
export abstract class BaseDecisionProvider implements IDecisionProvider {
  /**
   * Create a new provider
   * 
   * @param name - Provider name
   * @param supportedRuleTypes - Rule types this provider supports
   */
  constructor(
    public readonly name: string,
    public readonly supportedRuleTypes: string[]
  ) {}

  /**
   * Evaluate decision (must be implemented by subclass)
   */
  abstract evaluate(context: DecisionContext): Promise<DecisionResult>;

  /**
   * Default canHandle implementation (checks supportedRuleTypes)
   * 
   * Subclasses can override for custom validation.
   */
  canHandle(context: DecisionContext): boolean {
    return this.supportedRuleTypes.includes(context.ruleType);
  }

  /**
   * Helper: Create success result
   * 
   * @protected
   */
  protected createSuccessResult(
    approved: boolean,
    confidence: number,
    options: {
      reason?: string;
      matchedRules?: string[];
      metadata?: Record<string, unknown>;
    } = {}
  ): DecisionResult {
    return {
      approved,
      confidence: Math.max(0, Math.min(1, confidence)),
      reason: options.reason,
      matchedRules: options.matchedRules,
      metadata: options.metadata,
      executionTime: 0, // Filled by Engine
      provider: this.name,
      timestamp: new Date(),
    };
  }

  /**
   * Helper: Create error result
   * 
   * @protected
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
}

/**
 * Provider metadata for discovery and documentation
 * 
 * Optional interface providers can implement to provide rich metadata.
 */
export interface IDecisionProviderMetadata {
  /**
   * Provider description
   */
  description: string;

  /**
   * Provider version
   */
  version: string;

  /**
   * Supported decision types (from Section 14 taxonomy)
   */
  supportedDecisionTypes?: string[];

  /**
   * Provider-specific configuration schema
   */
  configSchema?: Record<string, unknown>;

  /**
   * Example usage
   */
  examples?: Array<{
    description: string;
    context: Partial<DecisionContext>;
    expectedResult: Partial<DecisionResult>;
  }>;
}

/**
 * Provider factory function type
 * 
 * Used for lazy provider instantiation in DI container.
 */
export type ProviderFactory = () => IDecisionProvider;

/**
 * Provider registration options
 */
export interface ProviderRegistrationOptions {
  /**
   * Provider instance or factory
   */
  provider: IDecisionProvider | ProviderFactory;

  /**
   * Override rule types (if different from provider.supportedRuleTypes)
   */
  overrideRuleTypes?: string[];

  /**
   * Provider priority (higher priority wins on conflicts)
   */
  priority?: number;

  /**
   * Provider metadata (optional)
   */
  metadata?: IDecisionProviderMetadata;
}
