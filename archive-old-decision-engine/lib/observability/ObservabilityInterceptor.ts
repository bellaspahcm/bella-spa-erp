/**
 * Decision Engine Observability Interceptor
 * 
 * Automatically collects metrics, audit trails, and emits events
 * for all decisions processed by the Decision Engine.
 * 
 * Wraps Decision Engine methods to:
 * - Start/stop execution timers
 * - Record metrics
 * - Create audit records
 * - Emit decision events
 * 
 * @module DecisionEngine/Observability
 */

import type { DecisionContext, DecisionResult } from '../types';
import { metricsCollector, type DecisionMetric } from './MetricsCollector';
import { auditTrail, type AuditRecord } from './AuditTrail';
import { eventEmitter, generateDecisionId } from './DecisionEvents';

export interface ObservabilityOptions {
  /** Enable metrics collection */
  collectMetrics?: boolean;
  /** Enable audit trail */
  enableAudit?: boolean;
  /** Enable event emission */
  emitEvents?: boolean;
  /** Decision type (e.g., 'booking_approval') */
  decisionType: string;
  /** Provider name */
  provider: string;
  /** Tenant ID */
  tenantId: string;
  /** User ID (optional) */
  userId?: string;
  /** Whether cache was used */
  cacheHit?: boolean;
}

/**
 * Observability interceptor for decision execution.
 * 
 * Wraps decision execution to automatically collect observability data.
 * 
 * @example
 * ```ts
 * const interceptor = new ObservabilityInterceptor();
 * 
 * const result = await interceptor.intercept(
 *   context,
 *   async (ctx) => {
 *     // Execute decision logic
 *     return await decisionEngine.evaluate(ctx);
 *   },
 *   {
 *     decisionType: 'booking_approval',
 *     provider: 'RuleProvider',
 *     tenantId: 'tenant-123',
 *     collectMetrics: true,
 *     enableAudit: true,
 *     emitEvents: true,
 *   }
 * );
 * ```
 */
export class ObservabilityInterceptor {
  /**
   * Intercept decision execution to collect observability data.
   * 
   * @param context - Decision context
   * @param executor - Decision execution function
   * @param options - Observability options
   * @returns Decision result
   */
  async intercept(
    context: DecisionContext,
    executor: (context: DecisionContext) => Promise<DecisionResult>,
    options: ObservabilityOptions
  ): Promise<DecisionResult> {
    const decisionId = generateDecisionId();
    const startTime = performance.now();
    const timestamp = new Date();

    let result: DecisionResult;
    let error: Error | undefined;
    let usedFallback = false;

    try {
      result = await executor(context);
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err));
      
      // Create fallback result
      result = {
        approved: false,
        confidence: 0,
        reason: `Decision failed: ${error.message}`,
        action: {
          type: 'MANUAL_REVIEW',
          data: {
            reason: 'System error, requires manual review',
            error: error.message,
          },
        },
        metadata: {
          error: error.message,
          fallback: true,
        },
        executionTime: 0, // Will be set later
        provider: 'fallback',
        timestamp: new Date(),
        error: {
          message: error.message,
          code: 'SYSTEM_ERROR',
          stack: error.stack,
        },
        isFallback: true,
      };
      usedFallback = true;
    }

    const endTime = performance.now();
    const executionTime = endTime - startTime;

    // Collect metrics
    if (options.collectMetrics !== false) {
      const metric: DecisionMetric = {
        timestamp,
        decisionType: options.decisionType,
        executionTime,
        confidence: result.confidence,
        provider: options.provider,
        rulesMatched: result.matchedRules?.length || 0,
        approved: result.approved,
        requiresManualReview: result.action?.type === 'MANUAL_REVIEW',
        cacheHit: options.cacheHit || false,
        failed: !!error,
        usedFallback,
        tenantId: options.tenantId,
      };
      metricsCollector.record(metric);
    }

    // Record audit trail
    if (options.enableAudit !== false) {
      const auditRecord: AuditRecord = {
        decisionId,
        decisionType: options.decisionType,
        timestamp,
        tenantId: options.tenantId,
        userId: options.userId,
        provider: options.provider,
        matchedRules: this.extractMatchedRules(result),
        executionTime,
        confidence: result.confidence,
        actions: result.action ? [result.action] : [],
        reason: result.reason || 'No reason provided',
        context,
        result,
        cacheHit: options.cacheHit || false,
        failed: !!error,
        error: error?.message,
        usedFallback,
        metadata: result.metadata,
      };
      auditTrail.record(auditRecord);
    }

    // Emit events
    if (options.emitEvents !== false) {
      const eventParams = {
        decisionId,
        decisionType: options.decisionType,
        tenantId: options.tenantId,
        userId: options.userId,
        provider: options.provider,
        context,
        result,
        executionTime,
        error: error?.message,
        metadata: result.metadata,
      };

      if (error) {
        await eventEmitter.emitFailed(eventParams);
      } else if (usedFallback) {
        await eventEmitter.emitFallback(eventParams);
      } else if (!result.approved) {
        await eventEmitter.emitRejected(eventParams);
      } else {
        await eventEmitter.emitCompleted(eventParams);
      }
    }

    return result;
  }

  /**
   * Extract matched rules from decision result.
   * 
   * Attempts to parse rule information from result metadata.
   * 
   * @param result - Decision result
   * @returns Matched rules array
   */
  private extractMatchedRules(result: DecisionResult): Array<{
    ruleId: string;
    priority: number;
    condition: string;
    action: unknown;
  }> {
    // Try to extract from metadata
    if (result.metadata?.matchedRules && Array.isArray(result.metadata.matchedRules)) {
      return result.metadata.matchedRules as Array<{
        ruleId: string;
        priority: number;
        condition: string;
        action: unknown;
      }>;
    }

    // Fallback: use matchedRules from result if available
    if (result.matchedRules && Array.isArray(result.matchedRules)) {
      return result.matchedRules.map((ruleId, index) => ({
        ruleId,
        priority: 100 - index * 10,
        condition: 'unknown',
        action: result.action || {},
      }));
    }

    // No rules matched
    return [];
  }
}

/**
 * Global observability interceptor singleton.
 */
export const observabilityInterceptor = new ObservabilityInterceptor();

/**
 * Helper function to wrap decision execution with observability.
 * 
 * @param context - Decision context
 * @param executor - Decision execution function
 * @param options - Observability options
 * @returns Decision result with observability data collected
 * 
 * @example
 * ```ts
 * const result = await withObservability(
 *   context,
 *   async (ctx) => await engine.evaluate(ctx),
 *   {
 *     decisionType: 'booking_approval',
 *     provider: 'RuleProvider',
 *     tenantId: 'tenant-123',
 *   }
 * );
 * ```
 */
export async function withObservability(
  context: DecisionContext,
  executor: (context: DecisionContext) => Promise<DecisionResult>,
  options: ObservabilityOptions
): Promise<DecisionResult> {
  return observabilityInterceptor.intercept(context, executor, options);
}
