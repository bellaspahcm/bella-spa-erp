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
  data: {
    // Context
    tenantId: string;
    module: string;
    decisionType: string;
    correlationId: string;

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
    userId?: string;
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
  }

  /**
   * Evaluate decision based on context
   * 
   * This is the main entry point. Business modules call this method with
   * DecisionContext and receive DecisionResult.
   * 
   * **Flow**:
   * 1. Validate context
   * 2. Select provider based on ruleType
   * 3. Delegate evaluation to provider (with timeout)
   * 4. Handle errors (fallback strategy)
   * 5. Enrich result with execution metadata
   * 6. Publish decision event (async, non-blocking)
   * 7. Log for observability
   * 8. Return result
   * 
   * **Error Handling**:
   * - Validation errors → Return error result
   * - Provider not found → Return error result
   * - Provider timeout → Return fallback result
   * - Provider error → Return fallback result
   * - All errors logged and published as events
   * 
   * **Performance**:
   * - Target: <50ms (rule-based)
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

      // 2. Select provider
      const provider = this.selectProvider(context);

      // 3. Delegate to provider (with timeout)
      const timeout = context.options?.timeout || this.defaultTimeoutMs;
      const result = await this.evaluateWithTimeout(
        provider,
        context,
        timeout,
        startTime
      );

      // 4. Enrich result with execution metadata
      const enrichedResult = this.enrichResult(result, startTime, context);

      // 5. Publish event (fire-and-forget, non-blocking)
      this.publishEvent(context, enrichedResult);

      // 6. Log for observability
      this.logDecision(context, enrichedResult);

      // 7. Return result
      return enrichedResult;
    } catch (error) {
      // Catastrophic error (shouldn't happen if provider implements error handling)
      return this.handleCatastrophicError(
        context,
        error as Error,
        startTime
      );
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
        fallbackResult.action = 'MANUAL_REVIEW';
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
      correlationId: context.correlationId,
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

    // Publish asynchronously (don't await)
    const event: DecisionEvaluatedEvent = {
      id: `decision-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'decision.evaluated',
      timestamp: new Date(),
      data: {
        // Context
        tenantId: context.tenantId,
        module: context.module,
        decisionType: context.decisionType,
        correlationId: context.correlationId || '',

        // Input
        ruleType: context.ruleType,
        inputData: context.data,

        // Output
        approved: result.approved,
        confidence: result.confidence,
        reason: result.reason,

        // Execution
        provider: result.provider,
        executionTime: result.executionTime,

        // User (optional)
        userId: context.user?.id,
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

    this.logger[logLevel](message, {
      // Identification
      correlationId: context.correlationId,
      tenantId: context.tenantId,
      module: context.module,
      decisionType: context.decisionType,

      // Input (sanitized)
      ruleType: context.ruleType,

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
}

/**
 * Create DecisionEngine instance
 * 
 * Factory function for convenience.
 * 
 * @param config - Configuration object
 * @returns DecisionEngine instance
 * 
 * @example
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
 */
export function createDecisionEngine(
  config: DecisionEngineConfig
): DecisionEngine {
  return new DecisionEngine(config);
}
