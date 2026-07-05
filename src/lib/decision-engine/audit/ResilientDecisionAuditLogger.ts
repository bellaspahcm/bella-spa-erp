/**
 * Resilient Decision Audit Logger (Production-Safe Version)
 * 
 * Enterprise-grade audit logging with resilience patterns.
 * 
 * Features:
 * - Fire-and-forget async logging (doesn't block decision execution)
 * - Retry Queue with exponential backoff (3 attempts)
 * - Dead Letter Queue (DLQ) for failed items
 * - Circuit Breaker (auto-disable when DB down)
 * - Graceful degradation (failures never break business decisions)
 * - Queue metrics for monitoring
 * 
 * Usage:
 * ```typescript
 * const logger = new ResilientDecisionAuditLogger(supabase);
 * await logger.logToAuditTrail(context, result); // Non-blocking
 * 
 * // Check health
 * const health = logger.getHealth();
 * console.log(health.queueMetrics.pending); // 0
 * console.log(health.circuitBreaker.state); // 'CLOSED'
 * ```
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { DecisionContext, DecisionResult } from '../types';
import { AuditQueue } from './AuditQueue';
import { CircuitBreaker, CircuitBreakerOpenError } from './CircuitBreaker';

export class ResilientDecisionAuditLogger {
  private queue: AuditQueue;
  private circuitBreaker: CircuitBreaker;

  constructor(private supabase: SupabaseClient) {
    // Initialize circuit breaker
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5, // Open after 5 failures
      successThreshold: 2, // Close after 2 successes
      timeout: 10000, // Try recovery after 10 seconds
      monitoringWindowMs: 60000, // Track failures in 1-minute window
    });

    // Initialize retry queue
    this.queue = new AuditQueue(
      async (payload) => {
        // Process via circuit breaker
        await this.circuitBreaker.execute(async () => {
          await this.persistToDatabase(payload);
        });
      },
      {
        maxAttempts: 3,
        baseDelayMs: 100,
        maxDelayMs: 5000,
        processingIntervalMs: 100,
        dlqMaxSize: 1000,
      }
    );
  }

  /**
   * Log decision to audit trail (fire-and-forget)
   * 
   * This method never throws - failures are handled internally by queue + circuit breaker
   */
  async logToAuditTrail(
    context: DecisionContext,
    result: DecisionResult
  ): Promise<void> {
    try {
      // Build audit log payload
      const payload = this.buildAuditPayload(context, result);

      // Enqueue for async processing
      this.queue.enqueue(payload);
    } catch (error) {
      // Even payload building errors shouldn't break decisions
      console.error('Failed to enqueue audit log:', error);
    }
  }

  /**
   * Build audit log payload from context + result
   */
  private buildAuditPayload(
    context: DecisionContext,
    result: DecisionResult
  ): any {
    const decisionId = context.decisionId || this.generateDecisionId();

    // Determine status
    let status: 'success' | 'error' | 'warning';
    if (result.error) {
      status = 'error';
    } else if (result.confidence !== undefined && result.confidence < 0.7) {
      status = 'warning';
    } else {
      status = 'success';
    }

    // Extract metadata
    const provider = result.metadata?.provider || 'unknown';
    const executionTimeMs = result.metadata?.executionTimeMs || 0;
    const policiesExecuted = result.metadata?.policiesExecuted || [];
    const auditLog = result.metadata?.auditLog || [];

    // Build version snapshot (MANDATORY for Time Machine)
    const versionSnapshot = context.versionSnapshot || {
      engineVersion: '1.0.0',
      policyVersions: result.metadata?.policyVersions || { 'default': '1.0.0' },
      ruleVersions: result.metadata?.ruleVersions || {},
      providerVersions: { [provider]: '1.0.0' },
    };

    // Build correlation context
    const correlationId =
      context.correlationContext?.correlationId || this.generateCorrelationId();
    const traceId = context.correlationContext?.traceId;
    const spanId = context.correlationContext?.spanId;
    const parentSpanId = context.correlationContext?.parentSpanId;

    return {
      decision_id: decisionId,
      decision_type: context.decisionType,
      provider,
      tenant_id: context.tenantId,
      user_id: context.userId,
      status,
      input_context: context.input,
      policies_executed: policiesExecuted,
      matched_rules: result.matchedRules || [],
      output: result.output,
      confidence_score: result.confidence,
      execution_time_ms: executionTimeMs,
      audit_log: auditLog,
      correlation_id: correlationId,
      trace_id: traceId,
      span_id: spanId,
      parent_span_id: parentSpanId,
      version_snapshot: versionSnapshot,
      resource_metrics: context.resourceMetrics || {},
      business_outcome: context.businessOutcome || {},
      ai_metadata: context.aiMetadata || {},
    };
  }

  /**
   * Persist payload to database (called by queue worker)
   */
  private async persistToDatabase(payload: any): Promise<void> {
    const { error } = await this.supabase
      .from('decision_audit_log')
      .insert(payload);

    if (error) {
      throw new Error(`Database insert failed: ${error.message}`);
    }
  }

  /**
   * Get health status
   */
  getHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    queueMetrics: ReturnType<AuditQueue['getMetrics']>;
    circuitBreaker: ReturnType<CircuitBreaker['getHealthStatus']>;
    dlqSize: number;
  } {
    const queueMetrics = this.queue.getMetrics();
    const circuitStatus = this.circuitBreaker.getHealthStatus();
    const dlqSize = this.queue.getDLQ().length;

    // Determine overall health
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (!circuitStatus.healthy) {
      status = 'unhealthy'; // Circuit open = critical
    } else if (dlqSize > 100 || queueMetrics.pending > 1000) {
      status = 'degraded'; // Backlog building up
    } else {
      status = 'healthy';
    }

    return {
      status,
      queueMetrics,
      circuitBreaker: circuitStatus,
      dlqSize,
    };
  }

  /**
   * Get Dead Letter Queue items
   */
  getDLQ(): any[] {
    return this.queue.getDLQ();
  }

  /**
   * Retry specific item from DLQ
   */
  retryFromDLQ(itemId: string): boolean {
    return this.queue.retryFromDLQ(itemId);
  }

  /**
   * Retry all items from DLQ
   */
  retryAllFromDLQ(): number {
    return this.queue.retryAllFromDLQ();
  }

  /**
   * Clear DLQ
   */
  clearDLQ(): number {
    return this.queue.clearDLQ();
  }

  /**
   * Manually reset circuit breaker
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down audit logger...');
    await this.queue.stop();
    console.log('Audit logger shutdown complete');
  }

  /**
   * Generate unique decision ID
   */
  private generateDecisionId(): string {
    return `dec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate correlation ID
   */
  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
