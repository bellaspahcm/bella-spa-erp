/**
 * Decision Engine Platform - BI Provider
 * 
 * Business Intelligence Provider for data-driven decisions.
 * Executes BI queries against database and evaluates thresholds.
 * 
 * @see docs/DECISION_ENGINE_PLATFORM_ARCHITECTURE.md Section 6
 */

import type { IDecisionProvider } from '../../abstractions/IDecisionProvider';
import { BaseDecisionProvider } from '../../abstractions/BaseDecisionProvider';
import type { DecisionContext, DecisionResult } from '../../types';
import { createSuccessResult, createErrorResult } from '../../types';
import type { IBIClient } from './IBIClient';
import { BIClientError, QueryError, QueryTimeoutError } from './IBIClient';
import type {
  BIQuery,
  BIQueryOptions,
  BIQueryResult,
  BIQueryWithThreshold,
  Threshold,
} from './types';
import { evaluateThreshold } from './types';

/**
 * BI Provider configuration
 */
export interface BIProviderConfig {
  /** BI client instance */
  client: IBIClient;
  
  /** Default query timeout in milliseconds (default: 30000) */
  defaultTimeout?: number;
  
  /** Enable query result caching (default: true) */
  enableCaching?: boolean;
  
  /** Cache TTL in seconds (default: 300) */
  cacheTTL?: number;
  
  /** Max rows to return (default: 10000) */
  maxRows?: number;
  
  /** Enable query explanation for debugging (default: false) */
  enableExplain?: boolean;
}

/**
 * BI Provider
 * 
 * Implements IDecisionProvider for BI-based decisions.
 * 
 * Supported rule types:
 * - 'bi-query': Generic BI query
 * - 'sql-query': Raw SQL query
 * - 'aggregation': Aggregation query (SUM, AVG, COUNT, etc.)
 * - 'time-series': Time-series analytics
 * - 'metric': Single metric query
 * 
 * @example Basic Usage
 * ```typescript
 * import { BIProvider, PostgreSQLClient, aggregation, threshold } from '@/lib/decision-engine';
 * 
 * const client = new PostgreSQLClient({
 *   host: 'localhost',
 *   database: 'bella_spa',
 *   user: 'postgres',
 *   password: 'password'
 * });
 * 
 * await client.connect();
 * 
 * const provider = new BIProvider({ client });
 * registry.register(provider);
 * 
 * const context: DecisionContext = {
 *   tenantId: 'bella-spa-vn',
 *   module: 'booking',
 *   decisionType: 'auto-approval',
 *   ruleType: 'aggregation',
 *   rule: {
 *     query: aggregation()
 *       .table('bookings')
 *       .count()
 *       .where('customer_id', customerId)
 *       .where('status', 'approved')
 *       .timeRange({ start: '2024-01-01', end: '2024-12-31' })
 *       .build(),
 *     threshold: threshold().gte(10).build()
 *   },
 *   data: { customerId: 123 }
 * };
 * 
 * const result = await engine.evaluate(context);
 * // result.approved = true if customer has >= 10 approved bookings
 * ```
 * 
 * @example With Cache
 * ```typescript
 * const provider = new BIProvider({
 *   client,
 *   enableCaching: true,
 *   cacheTTL: 600 // 10 minutes
 * });
 * ```
 */
export class BIProvider extends BaseDecisionProvider implements IDecisionProvider {
  readonly name = 'BIProvider';
  readonly supportedRuleTypes = [
    'bi-query',
    'sql-query',
    'aggregation',
    'time-series',
    'metric',
  ];

  private readonly client: IBIClient;
  private readonly config: Required<BIProviderConfig>;

  /**
   * Create BIProvider instance
   * 
   * @param config - Provider configuration
   */
  constructor(config: BIProviderConfig) {
    super('BIProvider', ['bi-query', 'bi-threshold', 'bi-aggregation']);
    
    this.client = config.client;
    this.config = {
      client: config.client,
      defaultTimeout: config.defaultTimeout ?? 30000,
      enableCaching: config.enableCaching ?? true,
      cacheTTL: config.cacheTTL ?? 300,
      maxRows: config.maxRows ?? 10000,
      enableExplain: config.enableExplain ?? false,
    };
  }

  /**
   * Evaluate decision based on BI query
   * 
   * Flow:
   * 1. Parse rule as BIQueryWithThreshold
   * 2. Build query options
   * 3. Execute query via BI client
   * 4. Evaluate threshold against result
   * 5. Return decision result
   * 
   * @param context - Decision context
   * @returns Promise<DecisionResult>
   */
  async evaluate(context: DecisionContext): Promise<DecisionResult> {
    const startTime = Date.now();

    try {
      // 1. Parse rule
      const rule = this.parseRule(context.rule);

      // 2. Build query options
      const queryOptions = this.buildQueryOptions(context);

      // 3. Execute query
      const queryResult = await this.executeQuery(rule.query, queryOptions);

      // 4. Evaluate threshold
      const approved = this.evaluateThresholdAgainstResult(
        queryResult,
        rule.threshold
      );

      // 5. Build decision result
      const confidence = this.calculateConfidence(queryResult, rule.threshold);
      const reason = this.buildReason(approved, queryResult, rule);

      return this.createSuccessResult(approved, confidence, {
        reason,
        metadata: {
          biResult: queryResult.value,
          queryExecutionTime: queryResult.metadata?.executionTime,
          queryHash: queryResult.metadata?.queryHash,
          threshold: rule.threshold,
        },
      });
    } catch (error) {
      return this.handleError(error as Error, startTime);
    }
  }

  /**
   * Parse rule from context
   * @private
   */
  private parseRule(rule: unknown): BIQueryWithThreshold {
    if (!rule || typeof rule !== 'object') {
      throw new Error('Rule must be an object');
    }

    const typed = rule as Partial<BIQueryWithThreshold>;

    if (!typed.query) {
      throw new Error('Rule must contain "query" property');
    }

    if (!typed.threshold) {
      throw new Error('Rule must contain "threshold" property');
    }

    return typed as BIQueryWithThreshold;
  }

  /**
   * Build query options from context
   * @private
   */
  private buildQueryOptions(context: DecisionContext): BIQueryOptions {
    const timeout = context.options?.timeout ?? this.config.defaultTimeout;

    return {
      timeout,
      cache: this.config.enableCaching,
      cacheTTL: this.config.cacheTTL,
      maxRows: this.config.maxRows,
      explain: this.config.enableExplain,
    };
  }

  /**
   * Execute BI query
   * @private
   */
  private async executeQuery<T = unknown>(
    query: BIQuery,
    options: BIQueryOptions
  ): Promise<BIQueryResult<T>> {
    try {
      return await this.client.execute<T>(query, options);
    } catch (error) {
      if (error instanceof QueryTimeoutError) {
        throw new Error(`Query timeout after ${options.timeout}ms`);
      }
      if (error instanceof QueryError) {
        throw new Error(`Query execution failed: ${error.message}`);
      }
      if (error instanceof BIClientError) {
        throw new Error(`BI client error: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Evaluate threshold against query result
   * @private
   */
  private evaluateThresholdAgainstResult(
    queryResult: BIQueryResult,
    threshold: Threshold
  ): boolean {
    const value = this.extractValueFromResult(queryResult);

    // If value is null/undefined, use fallback
    if (value === null || value === undefined) {
      return threshold.fallback ?? false;
    }

    return evaluateThreshold(value, threshold);
  }

  /**
   * Extract scalar value from query result
   * @private
   */
  private extractValueFromResult(result: BIQueryResult): number | string {
    const { value } = result;

    // If value is already scalar
    if (typeof value === 'number' || typeof value === 'string') {
      return value;
    }

    // If value is object with single property
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const keys = Object.keys(value);
      if (keys.length === 1) {
        const extracted = (value as Record<string, unknown>)[keys[0]];
        if (typeof extracted === 'number' || typeof extracted === 'string') {
          return extracted;
        }
      }
    }

    // If value is array with single element
    if (Array.isArray(value) && value.length === 1) {
      return this.extractValueFromResult({ value: value[0] });
    }

    throw new Error(
      `Cannot extract scalar value from result: ${JSON.stringify(value)}`
    );
  }

  /**
   * Calculate confidence based on query result
   * @private
   */
  private calculateConfidence(
    queryResult: BIQueryResult,
    threshold: Threshold
  ): number {
    // BI results have inherent uncertainty (data quality, sampling, timing)
    // Base confidence: 0.9
    let confidence = 0.9;

    // Reduce confidence if query execution time is high (may indicate data issues)
    if (queryResult.metadata?.executionTime && queryResult.metadata.executionTime > 10000) {
      confidence -= 0.05;
    }

    // Ensure confidence is in [0, 1]
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Build human-readable reason
   * @private
   */
  private buildReason(
    approved: boolean,
    queryResult: BIQueryResult,
    rule: BIQueryWithThreshold
  ): string {
    const value = this.extractValueFromResult(queryResult);
    const { operator, value: thresholdValue } = rule.threshold;

    const description = rule.description ?? 'BI metric';

    if (approved) {
      return `${description}: ${value} (threshold: ${operator} ${thresholdValue}) - APPROVED`;
    } else {
      return `${description}: ${value} (threshold: ${operator} ${thresholdValue}) - REJECTED`;
    }
  }

  /**
   * Handle errors
   * @private
   */
  private handleError(error: Error, startTime: number): DecisionResult {
    const executionTime = Date.now() - startTime;

    // Log error (would use logger in production)
    console.error('[BIProvider] Error:', error.message);

    return this.createErrorResult(error, executionTime);
  }

  /**
   * Check if provider can handle context
   * 
   * @param context - Decision context
   * @returns True if can handle
   */
  canHandle(context: DecisionContext): boolean {
    if (!this.supportedRuleTypes.includes(context.ruleType)) {
      return false;
    }

    // Verify rule structure
    try {
      this.parseRule(context.rule);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get BI client (for advanced usage)
   * 
   * @returns IBIClient instance
   */
  getClient(): IBIClient {
    return this.client;
  }

  /**
   * Get provider configuration
   * 
   * @returns Provider config
   */
  getConfig(): Required<BIProviderConfig> {
    return { ...this.config };
  }

  /**
   * Close BI client connection
   * 
   * Should be called when provider is no longer needed.
   * 
   * @returns Promise<void>
   */
  async close(): Promise<void> {
    await this.client.disconnect();
  }
}

/**
 * Create BIProvider instance
 * 
 * Factory function for convenience.
 * 
 * @param config - Provider configuration
 * @returns BIProvider instance
 * 
 * @example
 * ```typescript
 * import { createBIProvider, PostgreSQLClient } from '@/lib/decision-engine';
 * 
 * const client = new PostgreSQLClient({
 *   host: 'localhost',
 *   database: 'bella_spa'
 * });
 * 
 * await client.connect();
 * 
 * const provider = createBIProvider({ client });
 * ```
 */
export function createBIProvider(config: BIProviderConfig): BIProvider {
  return new BIProvider(config);
}
