/**
 * Decision Engine Platform - DecisionEngine Core Orchestrator
 * 
 * Stateless orchestrator that coordinates decision evaluation.
 * The heart of Decision Engine Platform.
 * 
 * @see docs/DECISION_ENGINE_PLATFORM_ARCHITECTURE.md Section 6, 13, 18
 */

import type { IEventPublisher } from '@/lib/events/abstractions/IEventPublisher';
import type { ILogger } from '@/lib/logger';
import type { ICache } from '../cache/ICache';
import type { ICacheStrategy } from '../cache/ICacheStrategy';
import {
  generateDecisionCacheKey,
  generateInvalidationPattern,
} from '../cache/utils';
import type { DecisionContext, DecisionResult } from '../types';
import {
  createErrorResult,
  createFallbackResult,
  sanitizeDecisionContext,
  sanitizeDecisionResult,
  validateDecisionContext,
} from '../types';
import type { DecisionProviderRegistry } from './DecisionProviderRegistry';
import { ProviderNotFoundError } from './DecisionProviderRegistry';

/**
 * Decision evaluation event
 */
interface DecisionEvaluatedEvent {
  id: string;
  type: 'decision.evaluated';
  timestamp: Date;
  tenantId: string; // Top-level for DomainEvent compatibility
  userId?: string;
  correlationId?: string;
  data: {
    // Context
    module: string;
    decisionType: string;

    // Input
    ruleType: string;
    inputData: Record<string, unknown>;

    // Output
    approved: boolean;
    confidence: number;
    reason?: string;

    // Execution
    provider: string;
    executionTime: number;

    // User (optional)
    userRole?: string;

    // Error (if any)
    error?: string;
    isFallback?: boolean;
  };
}

/**
 * Timeout error
 */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Configuration for DecisionEngine
 */
export interface DecisionEngineConfig {
  /** Provider registry (required) */
  registry: DecisionProviderRegistry;
  /** Event publisher (optional) */
  eventPublisher?: {
    publish(event: DecisionEvaluatedEvent): Promise<void>;
  };
  /** Logger (optional) */
  logger?: ILogger;
  /** Default timeout in ms (optional, default: 5000) */
  timeoutMs?: number;
  /** Fallback strategy on error (optional, default: RETHROW) */
  fallbackStrategy?: 'SAFE_DEFAULT' | 'MANUAL_REVIEW' | 'RETHROW';
  /** Cache instance (optional, external to Engine for statelessness) */
  cache?: ICache;
  /** Cache strategy (optional, determines caching behavior) */
  cacheStrategy?: ICacheStrategy;
}

/**
 * DecisionEngine - Stateless orchestrator
 * 
 * Core responsibilities:
 * 1. Receive DecisionContext from business modules
 * 2. Select appropriate provider from registry
 * 3. Delegate evaluation to provider
 * 4. Handle errors with fallback strategy
 * 5. Publish decision events
 * 6. Return standardized DecisionResult
 * 
 * Design Principles:
 * 1. Engine is STATELESS (no instance variables except injected dependencies)
 * 2. Engine is pure orchestrator (no business logic)
 * 3. Engine is error-resilient (fallback strategy)
 * 4. Engine is observable (logs and events)
 * 5. Engine never crashes (always returns a decision)
 * 
 * @example Basic Usage
 * ```typescript
 * const engine = new DecisionEngine({
 *   registry,
 *   eventPublisher,
 *   logger
 * });
 * 
 * const context: DecisionContext = {
 *   tenantId: 'bella-spa-vn',
 *   module: 'booking',
 *   decisionType: 'auto-approval',
 *   ruleType: 'if-then',
 *   rule: autoApprovalRule,
 *   data: { amount: 3000000 }
 * };
 * 
 * const result = await engine.evaluate(context);
 * 
 * if (result.approved) {
 *   await bookingService.approve(booking);
 * }
 * ```
 * 
 * @example With Error Handling
 * ```typescript
 * try {
 *   const result = await engine.evaluate(context);
 *   
 *   if (result.isFallback) {
 *     // Handle fallback result (system error)
 *     await notifyAdmin('Decision system failure', result.error);
 *   } else {
 *     // Normal result
 *     await handleDecision(result);
 *   }
 * } catch (error) {
 *   // Should rarely happen (Engine catches most errors)
 *   console.error('Critical decision engine failure', error);
 * }
 * ```
 */
export class DecisionEngine {
  private readonly registry: DecisionProviderRegistry;
  private readonly eventPublisher?: {
    publish(event: DecisionEvaluatedEvent): Promise<void>;
  };
  private readonly logger?: ILogger;
  private readonly defaultTimeoutMs: number;
  private readonly fallbackStrategy: 'SAFE_DEFAULT' | 'MANUAL_REVIEW' | 'RETHROW';
  private readonly cache?: ICache;
  private readonly cacheStrategy?: ICacheStrategy;

  // Cache statistics (NOT instance state, just counters for observability)
  private cacheHits: number = 0;
  private cacheMisses: number = 0;

  /**
   * Create DecisionEngine instance
   * 
   * @param config - Configuration object
   */
  constructor(config: DecisionEngineConfig) {
    this.registry = config.registry;
    this.eventPublisher = config.eventPublisher;
    this.logger = config.logger;
    this.defaultTimeoutMs = config.timeoutMs || 5000;
    this.fallbackStrategy = config.fallbackStrategy || 'RETHROW';
    this.cache = config.cache;
    this.cacheStrategy = config.cacheStrategy;
  }

  /**
   * Evaluate decision based on context
   * 
   * This is the main entry point. Business modules call this method with
   * DecisionContext and receive DecisionResult.
   * 
   * **Flow**:
   * 1. Validate context
   * 2. Check cache (if enabled)
   * 3. Select provider based on ruleType
   * 4. Delegate evaluation to provider (with timeout)
   * 5. Handle errors (fallback strategy)
   * 6. Store result in cache (if enabled and cacheable)
   * 7. Enrich result with execution metadata
   * 8. Publish decision event (async, non-blocking)
   * 9. Log for observability
   * 10. Return result
   * 
   * **Error Handling**:
   * - Validation errors → Return error result
   * - Provider not found → Return error result
   * - Provider timeout → Return fallback result
   * - Provider error → Return fallback result
   * - Cache errors → Gracefully degrade (log and continue)
   * - All errors logged and published as events
   * 
   * **Performance**:
   * - Target: <50ms (rule-based, no cache)
   * - Target: <10ms (with cache hit)
   * - Timeout: 5000ms (configurable via context.options.timeout)
   * - Non-blocking event publishing
   * 
   * @param context - Decision context with all input data
   * @returns Promise<DecisionResult> - Standardized decision result
   * 
   * @example
   * ```typescript
   * const result = await engine.evaluate({
   *   tenantId: 'bella-spa-vn',
   *   module: 'booking',
   *   decisionType: 'auto-approval',
   *   ruleType: 'if-then',
   *   rule: { condition: {...}, action: {...} },
   *   data: { amount: 3000000 }
   * });
   * ```
   */
  async evaluate(context: DecisionContext): Promise<DecisionResult> {
    const startTime = Date.now();

    try {
      // 1. Validate context
      this.validateContext(context);

      // 2. Check cache (if enabled)
      const cachedResult = await this.getCachedResult(context);
      if (cachedResult) {
        this.cacheHits++;
        this.logger?.debug('Cache hit', {
          cacheKey: this.generateCacheKey(context),
          correlationId: context.correlationId,
        });

        // Enrich with fresh timestamp and return
        return {
          ...cachedResult,
          timestamp: new Date(),
          executionTime: Date.now() - startTime,
          metadata: {
            ...cachedResult.metadata,
            fromCache: true,
          },
        };
      }

      this.cacheMisses++;

      // 3. Select provider
      const provider = this.selectProvider(context);

      // 4. Delegate to provider (with timeout)
      const timeout = context.options?.timeout || this.defaultTimeoutMs;
      const result = await this.evaluateWithTimeout(
        provider,
        context,
        timeout,
        startTime
      );

      // 5. Store result in cache (if enabled and cacheable)
      await this.setCachedResult(context, result);

      // 6. Enrich result with execution metadata
      const enrichedResult = this.enrichResult(result, startTime, context);

      // 7. Publish event (fire-and-forget, non-blocking)
      this.publishEvent(context, enrichedResult);

      // 8. Log for observability
      this.logDecision(context, enrichedResult);

      // 9. Return result
      return enrichedResult;
    } catch (error) {
      // Catastrophic error - handle based on fallback strategy
      if (this.fallbackStrategy === 'RETHROW') {
        throw error;
      }

      return this.handleCatastrophicError(
        context,
        error as Error,
        startTime
      );
    }
  }

  /**
   * Generate cache key for context
   * @private
   */
  private generateCacheKey(context: DecisionContext): string {
    return generateDecisionCacheKey(context);
  }

  /**
   * Get cached result (if cache enabled and strategy allows)
   * @private
   */
  private async getCachedResult(
    context: DecisionContext
  ): Promise<DecisionResult | null> {
    if (!this.cache || !this.cacheStrategy) {
      return null;
    }

    try {
      // Check if caching is allowed for this context
      if (!this.cacheStrategy.shouldCache(context)) {
        return null;
      }

      // Generate cache key
      const cacheKey = this.generateCacheKey(context);

      // Get from cache
      const cached = await this.cache.get<DecisionResult>(cacheKey);

      return cached;
    } catch (error) {
      // Cache errors should not break decision flow
      this.logger?.warn('Cache read error (graceful degradation)', {
        error: (error as Error).message,
        correlationId: context.correlationId,
      });
      return null;
    }
  }

  /**
   * Store result in cache (if cache enabled and strategy allows)
   * @private
   */
  private async setCachedResult(
    context: DecisionContext,
    result: DecisionResult
  ): Promise<void> {
    if (!this.cache || !this.cacheStrategy) {
      return;
    }

    try {
      // Check if caching is allowed for this context
      if (!this.cacheStrategy.shouldCache(context)) {
        return;
      }

      // Generate cache key
      const cacheKey = this.generateCacheKey(context);

      // Get TTL from strategy
      const ttl = this.cacheStrategy.getTTL(context, result);

      // Store in cache
      await this.cache.set(cacheKey, result, ttl);
    } catch (error) {
      // Cache errors should not break decision flow
      this.logger?.warn('Cache write error (graceful degradation)', {
        error: (error as Error).message,
        correlationId: context.correlationId,
      });
    }
  }

  /**
   * Validate context (step 1)
   * @private
   */
  private validateContext(context: DecisionContext): void {
    try {
      validateDecisionContext(context);
    } catch (error) {
      throw new Error(`Invalid context: ${(error as Error).message}`);
    }
  }

  /**
   * Select provider (step 2)
   * @private
   */
  private selectProvider(context: DecisionContext) {
    const provider = this.registry.getProvider(context.ruleType);

    if (!provider) {
      throw new ProviderNotFoundError(context.ruleType);
    }

    // Verify provider can handle context
    if (!provider.canHandle(context)) {
      throw new Error(
        `Provider "${provider.name}" cannot handle context for rule type "${context.ruleType}"`
      );
    }

    return provider;
  }

  /**
   * Evaluate with timeout (step 3)
   * @private
   */
  private async evaluateWithTimeout(
    provider: any,
    context: DecisionContext,
    timeoutMs: number,
    startTime: number
  ): Promise<DecisionResult> {
    try {
      // Race between provider evaluation and timeout
      const result = await Promise.race([
        provider.evaluate(context),
        this.createTimeoutPromise(timeoutMs),
      ]);

      return result;
    } catch (error) {
      if (error instanceof TimeoutError) {
        // Provider timeout - return fallback
        this.logger?.warn('Provider evaluation timeout', {
          provider: provider.name,
          timeout: timeoutMs,
          context: sanitizeDecisionContext(context),
        });

        const fallbackResult = createFallbackResult(
          error,
          provider.name,
          Date.now() - startTime
        );
        fallbackResult.error = { code: 'EVALUATION_TIMEOUT', message: error.message };
        
        return fallbackResult;
      }

      // Provider evaluation error - return fallback if strategy allows
      if (this.fallbackStrategy === 'RETHROW') {
        throw error;
      }

      this.logger?.error('Provider evaluation failed', {
        provider: provider.name,
        error: (error as Error).message,
        context: sanitizeDecisionContext(context),
      });

      const fallbackResult = createFallbackResult(
        error as Error,
        provider.name,
        Date.now() - startTime
      );

      if (this.fallbackStrategy === 'MANUAL_REVIEW') {
        fallbackResult.action = {
          type: 'MANUAL_REVIEW',
          data: {
            reason: 'Provider evaluation failed',
            error: (error as Error).message,
          },
        };
      }

      return fallbackResult;
    }
  }

  /**
   * Create timeout promise
   * @private
   */
  private createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(
        () => reject(new TimeoutError(`Provider timeout after ${timeoutMs}ms`)),
        timeoutMs
      )
    );
  }

  /**
   * Enrich result with execution metadata (step 4)
   * @private
   */
  private enrichResult(
    result: DecisionResult,
    startTime: number,
    context: DecisionContext
  ): DecisionResult {
    return {
      ...result,
      executionTime: Date.now() - startTime,
      timestamp: new Date(),
    };
  }

  /**
   * Publish decision event (step 5)
   * 
   * Fire-and-forget (non-blocking). Event subscribers handle:
   * - Audit logging
   * - Analytics
   * - Workflow triggers
   * - Notifications
   * 
   * @private
   */
  private publishEvent(
    context: DecisionContext,
    result: DecisionResult
  ): void {
    if (!this.eventPublisher) {
      return;
    }

    // Sanitize context data before publishing
    const sanitizedContext = sanitizeDecisionContext(context);

    // Publish asynchronously (don't await)
    const event: DecisionEvaluatedEvent = {
      id: `decision-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'decision.evaluated',
      timestamp: new Date(),
      tenantId: context.tenantId,
      userId: context.user?.id,
      correlationId: context.correlationId,
      data: {
        // Context
        module: context.module,
        decisionType: context.decisionType,

        // Input (sanitized)
        ruleType: context.ruleType,
        inputData: sanitizedContext.data || {},

        // Output
        approved: result.approved,
        confidence: result.confidence,
        reason: result.reason,

        // Execution
        provider: result.provider,
        executionTime: result.executionTime,

        // User (optional)
        userRole: context.user?.role,

        // Error (if any)
        error: result.error?.message,
        isFallback: result.isFallback,
      },
    };

    // Fire-and-forget
    this.eventPublisher.publish(event).catch((error) => {
      // Log event publishing failure (shouldn't block decision)
      this.logger?.error('Failed to publish decision event', {
        error: error.message,
        event: event,
      });
    });
  }

  /**
   * Log decision (step 6)
   * @private
   */
  private logDecision(
    context: DecisionContext,
    result: DecisionResult
  ): void {
    if (!this.logger) {
      return;
    }

    const logLevel = result.isFallback ? 'warn' : 'info';
    const message = result.isFallback
      ? 'Decision evaluated (fallback)'
      : 'Decision evaluated';

    // Sanitize context data before logging
    const sanitizedContext = sanitizeDecisionContext(context);

    this.logger[logLevel](message, {
      // Identification
      correlationId: context.correlationId,
      tenantId: context.tenantId,
      module: context.module,
      decisionType: context.decisionType,

      // Input (sanitized)
      ruleType: context.ruleType,
      data: sanitizedContext.data,

      // Output
      approved: result.approved,
      confidence: result.confidence,
      reason: result.reason,

      // Execution
      provider: result.provider,
      executionTime: result.executionTime,

      // Error (if any)
      error: result.error?.message,
      isFallback: result.isFallback,
    });
  }

  /**
   * Handle catastrophic error (shouldn't happen normally)
   * 
   * This is the last-resort error handler for errors that slip through
   * provider error handling.
   * 
   * @private
   */
  private handleCatastrophicError(
    context: DecisionContext,
    error: Error,
    startTime: number
  ): DecisionResult {
    // Log catastrophic error
    this.logger?.error('Catastrophic decision engine error', {
      error: error.message,
      stack: error.stack,
      context: sanitizeDecisionContext(context),
    });

    // Return safe default (reject)
    if (error instanceof ProviderNotFoundError) {
      return createErrorResult(
        'PROVIDER_NOT_FOUND',
        error.message,
        'error-handler'
      );
    }

    return createFallbackResult(error, 'error-handler', Date.now() - startTime);
  }

  /**
   * Get cache statistics
   * 
   * Returns cache hit/miss metrics for observability.
   * 
   * @returns Cache statistics
   * 
   * @example
   * ```typescript
   * const stats = engine.getCacheStats();
   * console.log(`Cache hit rate: ${stats.hitRate.toFixed(2)}%`);
   * ```
   */
  getCacheStats(): {
    hits: number;
    misses: number;
    hitRate: number;
    totalRequests: number;
    cacheEnabled: boolean;
  } {
    const totalRequests = this.cacheHits + this.cacheMisses;
    const hitRate = totalRequests > 0 ? (this.cacheHits / totalRequests) * 100 : 0;

    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate,
      totalRequests,
      cacheEnabled: !!this.cache,
    };
  }

  /**
   * Invalidate cache for specific decision type
   * 
   * Useful when rules change and cached results are no longer valid.
   * 
   * @param tenantId - Tenant ID
   * @param module - Module name (optional, invalidates all if omitted)
   * @param decisionType - Decision type (optional, invalidates all if omitted)
   * @returns Number of keys deleted
   * 
   * @example Invalidate all booking decisions
   * ```typescript
   * await engine.invalidateCache('bella-spa-vn', 'booking');
   * ```
   * 
   * @example Invalidate specific decision type
   * ```typescript
   * await engine.invalidateCache('bella-spa-vn', 'booking', 'auto-approval');
   * ```
   * 
   * @example Invalidate all tenant decisions
   * ```typescript
   * await engine.invalidateCache('bella-spa-vn');
   * ```
   */
  async invalidateCache(
    tenantId: string,
    module?: string,
    decisionType?: string
  ): Promise<number> {
    if (!this.cache) {
      this.logger?.warn('Cache invalidation requested but cache not enabled');
      return 0;
    }

    try {
      // Generate invalidation pattern
      const pattern = generateInvalidationPattern(tenantId, decisionType);

      // Delete matching keys
      const deletedCount = await this.cache.delete(pattern);

      this.logger?.info('Cache invalidated', {
        tenantId,
        module,
        decisionType,
        pattern,
        deletedCount,
      });

      return deletedCount;
    } catch (error) {
      this.logger?.error('Cache invalidation failed', {
        error: (error as Error).message,
        tenantId,
        module,
        decisionType,
      });
      return 0;
    }
  }

  /**
   * Warm cache with pre-computed decisions
   * 
   * Pre-loads cache with common decision scenarios to reduce
   * cold-start latency.
   * 
   * @param contexts - Array of decision contexts to warm
   * @returns Promise<{ success: number; failed: number }>
   * 
   * @example
   * ```typescript
   * const commonScenarios = [
   *   { tenantId: 'bella-spa-vn', module: 'booking', decisionType: 'auto-approval', ... },
   *   { tenantId: 'bella-spa-vn', module: 'booking', decisionType: 'pricing', ... },
   * ];
   * 
   * const result = await engine.warmCache(commonScenarios);
   * console.log(`Warmed ${result.success} cache entries`);
   * ```
   */
  async warmCache(
    contexts: DecisionContext[]
  ): Promise<{ success: number; failed: number }> {
    if (!this.cache) {
      this.logger?.warn('Cache warming requested but cache not enabled');
      return { success: 0, failed: 0 };
    }

    let success = 0;
    let failed = 0;

    this.logger?.info('Starting cache warming', {
      totalContexts: contexts.length,
    });

    for (const context of contexts) {
      try {
        // Evaluate decision (will cache automatically)
        await this.evaluate(context);
        success++;
      } catch (error) {
        this.logger?.warn('Cache warming failed for context', {
          error: (error as Error).message,
          context: sanitizeDecisionContext(context),
        });
        failed++;
      }
    }

    this.logger?.info('Cache warming complete', {
      success,
      failed,
      total: contexts.length,
    });

    return { success, failed };
  }

  /**
   * Clear all cached decisions
   * 
   * **WARNING**: This clears the entire cache. Use with caution.
   * 
   * @returns Promise<void>
   * 
   * @example
   * ```typescript
   * await engine.clearCache();
   * ```
   */
  async clearCache(): Promise<void> {
    if (!this.cache) {
      this.logger?.warn('Cache clear requested but cache not enabled');
      return;
    }

    try {
      await this.cache.clear();
      this.logger?.info('Cache cleared');
    } catch (error) {
      this.logger?.error('Cache clear failed', {
        error: (error as Error).message,
      });
    }
  }
}

/**
 * Create DecisionEngine instance
 * 
 * Factory function for convenience.
 * 
 * @param config - Configuration object
 * @returns DecisionEngine instance
 * 
 * @example Basic Usage
 * ```typescript
 * import { createDecisionEngine, createProviderRegistry } from '@/lib/decision-engine';
 * import { InMemoryEventPublisher } from '@/lib/events';
 * import { ConsoleLogger } from '@/lib/logger';
 * 
 * const registry = createProviderRegistry();
 * registry.register(new RuleProvider());
 * 
 * const engine = createDecisionEngine({
 *   registry,
 *   eventPublisher: new InMemoryEventPublisher(),
 *   logger: new ConsoleLogger()
 * });
 * ```
 * 
 * @example With In-Memory Cache
 * ```typescript
 * import {
 *   createDecisionEngine,
 *   createProviderRegistry,
 *   createInMemoryCache,
 *   DefaultCacheStrategy,
 * } from '@/lib/decision-engine';
 * 
 * const cache = createInMemoryCache({ maxKeys: 10000 });
 * const strategy = new DefaultCacheStrategy();
 * 
 * const engine = createDecisionEngine({
 *   registry,
 *   cache,
 *   cacheStrategy: strategy,
 *   logger
 * });
 * ```
 * 
 * @example With Redis Cache
 * ```typescript
 * import {
 *   createDecisionEngine,
 *   createRedisCache,
 *   AggressiveCacheStrategy,
 * } from '@/lib/decision-engine';
 * 
 * const cache = createRedisCache({
 *   host: 'localhost',
 *   port: 6379,
 *   defaultTTL: 300
 * });
 * 
 * const strategy = new AggressiveCacheStrategy();
 * 
 * const engine = createDecisionEngine({
 *   registry,
 *   cache,
 *   cacheStrategy: strategy,
 *   logger
 * });
 * ```
 */
export function createDecisionEngine(
  config: DecisionEngineConfig
): DecisionEngine {
  return new DecisionEngine(config);
}
