/**
 * Resilient Decision Audit Logger Bridge
 * 
 * Extends DecisionAuditLogger but delegates to ResilientDecisionAuditLogger
 * for fire-and-forget logging with circuit breaker, retry queue, and DLQ.
 * 
 * This is a PRODUCTION-SAFE logger that never blocks decisions.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type { DecisionContext, DecisionResult } from '../types';
import { DecisionAuditLogger, type CorrelationContext, type VersionSnapshot, type ResourceMetrics, type BusinessOutcome, type AIMetadata } from './DecisionAuditLogger';
import { ResilientDecisionAuditLogger } from './ResilientDecisionAuditLogger';

/**
 * Resilient Decision Audit Logger Bridge
 * 
 * Satisfies DecisionEngine's type requirements (extends DecisionAuditLogger)
 * while using ResilientDecisionAuditLogger internally for resilience.
 */
export class ResilientDecisionAuditLoggerBridge extends DecisionAuditLogger {
  private resilientLogger: ResilientDecisionAuditLogger;

  constructor(supabase: SupabaseClient<Database>, engineVersion: string = '1.0.0') {
    super(supabase, engineVersion);
    this.resilientLogger = new ResilientDecisionAuditLogger(supabase);
  }

  /**
   * Override logDecision to use resilient logger
   * 
   * Fire-and-forget (non-blocking). Failures are handled by circuit breaker + retry queue.
   */
  async logDecision(
    context: DecisionContext,
    result: DecisionResult,
    options?: {
      correlation?: CorrelationContext;
      versionSnapshot?: VersionSnapshot;
      resourceMetrics?: ResourceMetrics;
      businessOutcome?: BusinessOutcome;
      aiMetadata?: AIMetadata;
    }
  ): Promise<void> {
    // Delegate to resilient logger (fire-and-forget)
    // No need to await - this is non-blocking by design
    await this.resilientLogger.logToAuditTrail(context, result);
  }

  /**
   * Expose health monitoring
   */
  getHealth() {
    return this.resilientLogger.getHealth();
  }

  /**
   * Expose DLQ management
   */
  getDLQ() {
    return this.resilientLogger.getDLQ();
  }

  retryFromDLQ(itemId: string): boolean {
    return this.resilientLogger.retryFromDLQ(itemId);
  }

  retryAllFromDLQ(): number {
    return this.resilientLogger.retryAllFromDLQ();
  }

  clearDLQ(): number {
    return this.resilientLogger.clearDLQ();
  }

  resetCircuitBreaker(): void {
    this.resilientLogger.resetCircuitBreaker();
  }

  async shutdown(): Promise<void> {
    await this.resilientLogger.shutdown();
  }
}
