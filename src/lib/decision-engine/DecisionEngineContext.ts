/**
 * Decision Engine Context (Platform Service)
 * 
 * ARCHITECTURE PRINCIPLE:
 * - Wrapper pattern: Automatically instruments ALL provider executions
 * - Domain-agnostic: Works for any provider in any domain
 * - Separation of concerns: Providers don't know about metrics, observability, or monitoring
 * - Single source of truth: All provider executions go through this context
 * 
 * BENEFITS:
 * - No code duplication across providers
 * - Automatic metrics emission
 * - Consistent error handling
 * - Easy to add cross-cutting concerns (tracing, logging, caching, etc.)
 * - Provider code stays clean (only business logic)
 * 
 * USAGE:
 * 
 * @example
 * // Instead of calling provider directly:
 * const result = await provider.evaluate(input);
 * 
 * // Use DecisionEngineContext:
 * const context = DecisionEngineContext.create({
 *   tenantId: 'tenant-123',
 *   providerType: 'capacity_management',
 *   operation: 'checkCapacity',
 * });
 * const result = await context.execute(() => provider.evaluate(input));
 * // Metrics automatically emitted ^^^
 */

import MetricsCollector, { type MetricEvent, type ProviderType, measureExecutionTime } from './MetricsCollector';

// ============================================================================
// Types
// ============================================================================

export interface DecisionEngineContextConfig {
  // Provider identification
  providerType: ProviderType;
  operation: string;
  
  // Tenant context
  tenantId: string;
  
  // Business context (optional, domain-specific)
  context?: {
    userId?: string;
    entityId?: string; // booking_id, salary_record_id, order_id, etc.
    customerId?: string;
    ktvId?: string;
    [key: string]: unknown; // Extensible
  };
  
  // Skip flags (for manager overrides)
  skipFlags?: Record<string, boolean>;
  
  // Metadata (additional info for metrics)
  metadata?: Record<string, unknown>;
}

export interface ExecutionResult<T> {
  // Provider result
  result: T;
  
  // Execution metadata
  executionTimeMs: number;
  success: boolean;
  error?: Error;
}

// ============================================================================
// DecisionEngineContext Class
// ============================================================================

export class DecisionEngineContext {
  private config: DecisionEngineContextConfig;

  private constructor(config: DecisionEngineContextConfig) {
    this.config = config;
  }

  /**
   * Create a new DecisionEngineContext
   * 
   * @param config - Context configuration
   * @returns DecisionEngineContext instance
   */
  static create(config: DecisionEngineContextConfig): DecisionEngineContext {
    return new DecisionEngineContext(config);
  }

  /**
   * Execute a provider function with automatic instrumentation
   * 
   * This is the core method that wraps provider execution with:
   * - Performance measurement
   * - Error handling
   * - Metrics emission
   * - Logging
   * 
   * @param fn - Provider function to execute
   * @param outcomeExtractor - Optional function to extract outcome from result
   * @returns Provider result
   */
  async execute<T>(
    fn: () => Promise<T>,
    outcomeExtractor?: (result: T) => string
  ): Promise<T> {
    const startTime = performance.now();
    let success = false;
    let outcome: string | undefined;
    let error: Error | undefined;
    let result: T;

    try {
      // Execute provider
      result = await fn();
      success = true;

      // Extract outcome (if extractor provided)
      if (outcomeExtractor) {
        try {
          outcome = outcomeExtractor(result);
        } catch (outcomeError) {
          console.warn('[DecisionEngineContext] Failed to extract outcome:', outcomeError);
          outcome = 'unknown';
        }
      }

      return result;
    } catch (err) {
      // Provider execution failed
      success = false;
      error = err instanceof Error ? err : new Error(String(err));
      outcome = 'error';

      // Re-throw error (don't swallow business logic failures)
      throw error;
    } finally {
      // Always emit metrics (even on failure)
      const executionTimeMs = performance.now() - startTime;

      try {
        await this.emitMetric({
          success,
          outcome,
          executionTimeMs,
          error,
        });
      } catch (metricsError) {
        // Never let metrics emission crash the app
        console.error('[DecisionEngineContext] Failed to emit metric:', metricsError);
      }
    }
  }

  /**
   * Execute with explicit success/outcome (for complex providers)
   * 
   * Use this when the provider result doesn't clearly indicate success/outcome.
   * 
   * @example
   * const result = await context.executeWithOutcome(
   *   () => provider.evaluate(input),
   *   (result) => ({
   *     success: result.conflicts.length === 0,
   *     outcome: result.conflicts.length > 0 ? 'conflicts_detected' : 'no_conflicts',
   *   })
   * );
   */
  async executeWithOutcome<T>(
    fn: () => Promise<T>,
    outcomeExtractor: (result: T) => { success: boolean; outcome: string; metadata?: Record<string, unknown> }
  ): Promise<T> {
    const startTime = performance.now();
    let success = false;
    let outcome: string | undefined;
    let additionalMetadata: Record<string, unknown> = {};
    let error: Error | undefined;
    let result: T;

    try {
      // Execute provider
      result = await fn();

      // Extract success/outcome
      try {
        const extracted = outcomeExtractor(result);
        success = extracted.success;
        outcome = extracted.outcome;
        additionalMetadata = extracted.metadata || {};
      } catch (outcomeError) {
        console.warn('[DecisionEngineContext] Failed to extract outcome:', outcomeError);
        success = true; // Assume success if extractor fails
        outcome = 'unknown';
      }

      return result;
    } catch (err) {
      // Provider execution failed
      success = false;
      error = err instanceof Error ? err : new Error(String(err));
      outcome = 'error';

      // Re-throw error
      throw error;
    } finally {
      // Always emit metrics
      const executionTimeMs = performance.now() - startTime;

      try {
        await this.emitMetric({
          success,
          outcome,
          executionTimeMs,
          error,
          additionalMetadata,
        });
      } catch (metricsError) {
        console.error('[DecisionEngineContext] Failed to emit metric:', metricsError);
      }
    }
  }

  /**
   * Emit metric event (internal)
   */
  private async emitMetric(data: {
    success: boolean;
    outcome?: string;
    executionTimeMs: number;
    error?: Error;
    additionalMetadata?: Record<string, unknown>;
  }): Promise<void> {
    const event: MetricEvent = {
      providerType: this.config.providerType,
      operation: this.config.operation,
      success: data.success,
      outcome: data.outcome,
      executionTimeMs: data.executionTimeMs,
      context: {
        tenantId: this.config.tenantId,
        userId: this.config.context?.userId,
        entityId: this.config.context?.entityId,
        customerId: this.config.context?.customerId,
        ktvId: this.config.context?.ktvId,
      },
      metadata: {
        ...this.config.metadata,
        ...data.additionalMetadata,
        ...(data.error && { error: data.error.message }),
      },
      skipFlags: this.config.skipFlags,
    };

    // Fire-and-forget metric emission
    await MetricsCollector.emit(event);
  }

  /**
   * Update context (useful for chaining operations)
   */
  withMetadata(metadata: Record<string, unknown>): DecisionEngineContext {
    return new DecisionEngineContext({
      ...this.config,
      metadata: {
        ...this.config.metadata,
        ...metadata,
      },
    });
  }

  /**
   * Update skip flags
   */
  withSkipFlags(skipFlags: Record<string, boolean>): DecisionEngineContext {
    return new DecisionEngineContext({
      ...this.config,
      skipFlags: {
        ...this.config.skipFlags,
        ...skipFlags,
      },
    });
  }

  /**
   * Update context
   */
  withContext(context: Partial<NonNullable<DecisionEngineContextConfig['context']>>): DecisionEngineContext {
    return new DecisionEngineContext({
      ...this.config,
      context: {
        ...this.config.context,
        ...context,
      },
    });
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create and execute in one call (convenience)
 * 
 * @example
 * const result = await executeWithMetrics(
 *   {
 *     providerType: 'capacity_management',
 *     operation: 'checkCapacity',
 *     tenantId: 'tenant-123',
 *   },
 *   () => provider.evaluate(input)
 * );
 */
export async function executeWithMetrics<T>(
  config: DecisionEngineContextConfig,
  fn: () => Promise<T>,
  outcomeExtractor?: (result: T) => string
): Promise<T> {
  const context = DecisionEngineContext.create(config);
  return context.execute(fn, outcomeExtractor);
}

// ============================================================================
// Exports
// ============================================================================

export default DecisionEngineContext;
