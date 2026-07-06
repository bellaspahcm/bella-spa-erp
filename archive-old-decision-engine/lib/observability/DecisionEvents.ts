/**
 * Decision Engine Event System
 * 
 * Publishes events for decision lifecycle and outcomes.
 * Enables integration with Workflow Engine and external subscribers.
 * 
 * Event Types:
 * - decision.completed - Decision successfully evaluated
 * - decision.rejected - Decision rejected by rules
 * - decision.failed - Provider or engine error
 * - decision.fallback - Fallback strategy used
 * - decision.timeout - Evaluation timeout
 * 
 * @module DecisionEngine/Observability
 */

import type { DecisionContext, DecisionResult } from '../types';

export type DecisionEventType =
  | 'decision.completed'
  | 'decision.rejected'
  | 'decision.failed'
  | 'decision.fallback'
  | 'decision.timeout';

export interface DecisionEventPayload {
  /** Event ID */
  eventId: string;
  /** Event type */
  type: DecisionEventType;
  /** Timestamp when event occurred */
  timestamp: Date;
  /** Decision ID */
  decisionId: string;
  /** Decision type (e.g., 'booking_approval') */
  decisionType: string;
  /** Tenant ID */
  tenantId: string;
  /** User ID (if applicable) */
  userId?: string;
  /** Provider used */
  provider: string;
  /** Decision context */
  context: DecisionContext;
  /** Decision result */
  result: DecisionResult;
  /** Execution time in milliseconds */
  executionTime: number;
  /** Error message (if failed) */
  error?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export type DecisionEventHandler = (payload: DecisionEventPayload) => void | Promise<void>;

/**
 * Decision event emitter.
 * 
 * Implements pub-sub pattern for decision events.
 * Allows external systems to subscribe to decision outcomes.
 * 
 * Integration examples:
 * - Workflow Engine: Subscribe to trigger downstream workflows
 * - Analytics: Subscribe to track business metrics
 * - Alerting: Subscribe to monitor error rates
 * - Audit: Subscribe to log compliance events
 * 
 * @example
 * ```ts
 * // Subscribe to all decision completions
 * eventEmitter.on('decision.completed', async (event) => {
 *   console.log(`Decision ${event.decisionId} completed in ${event.executionTime}ms`);
 *   
 *   // Trigger workflow if decision requires manual review
 *   if (event.result.requiresManualReview) {
 *     await workflowEngine.start('manual-review-workflow', {
 *       decisionId: event.decisionId,
 *       tenantId: event.tenantId,
 *     });
 *   }
 * });
 * 
 * // Subscribe to failures for alerting
 * eventEmitter.on('decision.failed', async (event) => {
 *   await alerting.send({
 *     severity: 'error',
 *     message: `Decision Engine failed: ${event.error}`,
 *     decisionId: event.decisionId,
 *   });
 * });
 * ```
 */
export class DecisionEventEmitter {
  private handlers: Map<DecisionEventType, DecisionEventHandler[]> = new Map();

  /**
   * Subscribe to decision events.
   * 
   * @param type - Event type to subscribe to
   * @param handler - Event handler function
   * 
   * @example
   * ```ts
   * eventEmitter.on('decision.completed', (event) => {
   *   console.log(`Decision: ${event.decisionId}`);
   * });
   * ```
   */
  on(type: DecisionEventType, handler: DecisionEventHandler): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)!.push(handler);
  }

  /**
   * Unsubscribe from decision events.
   * 
   * @param type - Event type to unsubscribe from
   * @param handler - Event handler to remove
   * 
   * @example
   * ```ts
   * const handler = (event) => { ... };
   * eventEmitter.on('decision.completed', handler);
   * 
   * // Later, unsubscribe
   * eventEmitter.off('decision.completed', handler);
   * ```
   */
  off(type: DecisionEventType, handler: DecisionEventHandler): void {
    const handlers = this.handlers.get(type);
    if (!handlers) return;

    const index = handlers.indexOf(handler);
    if (index !== -1) {
      handlers.splice(index, 1);
    }
  }

  /**
   * Emit a decision event.
   * 
   * Calls all registered handlers for the event type.
   * Handlers are called asynchronously and errors are logged but not thrown.
   * 
   * @param payload - Event payload
   * 
   * @example
   * ```ts
   * eventEmitter.emit({
   *   eventId: 'evt-123',
   *   type: 'decision.completed',
   *   timestamp: new Date(),
   *   decisionId: 'dec-123',
   *   decisionType: 'booking_approval',
   *   tenantId: 'tenant-123',
   *   provider: 'RuleProvider',
   *   context: { ... },
   *   result: { ... },
   *   executionTime: 12.5,
   * });
   * ```
   */
  async emit(payload: DecisionEventPayload): Promise<void> {
    const handlers = this.handlers.get(payload.type);
    if (!handlers || handlers.length === 0) {
      return;
    }

    // Call handlers asynchronously
    await Promise.all(
      handlers.map(async (handler) => {
        try {
          await handler(payload);
        } catch (error) {
          console.error(`[DecisionEventEmitter] Handler error for ${payload.type}:`, error);
        }
      })
    );
  }

  /**
   * Emit decision.completed event.
   * 
   * @param params - Event parameters
   */
  async emitCompleted(params: Omit<DecisionEventPayload, 'eventId' | 'type' | 'timestamp'>): Promise<void> {
    await this.emit({
      ...params,
      eventId: `evt-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      type: 'decision.completed',
      timestamp: new Date(),
    });
  }

  /**
   * Emit decision.rejected event.
   * 
   * @param params - Event parameters
   */
  async emitRejected(params: Omit<DecisionEventPayload, 'eventId' | 'type' | 'timestamp'>): Promise<void> {
    await this.emit({
      ...params,
      eventId: `evt-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      type: 'decision.rejected',
      timestamp: new Date(),
    });
  }

  /**
   * Emit decision.failed event.
   * 
   * @param params - Event parameters
   */
  async emitFailed(params: Omit<DecisionEventPayload, 'eventId' | 'type' | 'timestamp'>): Promise<void> {
    await this.emit({
      ...params,
      eventId: `evt-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      type: 'decision.failed',
      timestamp: new Date(),
    });
  }

  /**
   * Emit decision.fallback event.
   * 
   * @param params - Event parameters
   */
  async emitFallback(params: Omit<DecisionEventPayload, 'eventId' | 'type' | 'timestamp'>): Promise<void> {
    await this.emit({
      ...params,
      eventId: `evt-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      type: 'decision.fallback',
      timestamp: new Date(),
    });
  }

  /**
   * Emit decision.timeout event.
   * 
   * @param params - Event parameters
   */
  async emitTimeout(params: Omit<DecisionEventPayload, 'eventId' | 'type' | 'timestamp'>): Promise<void> {
    await this.emit({
      ...params,
      eventId: `evt-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      type: 'decision.timeout',
      timestamp: new Date(),
    });
  }

  /**
   * Get number of handlers for an event type.
   * 
   * @param type - Event type
   * @returns Number of handlers
   */
  handlerCount(type: DecisionEventType): number {
    return this.handlers.get(type)?.length || 0;
  }

  /**
   * Clear all handlers (for testing).
   */
  clear(): void {
    this.handlers.clear();
  }
}

/**
 * Global decision event emitter singleton.
 * 
 * External systems subscribe to this emitter to receive decision events.
 */
export const eventEmitter = new DecisionEventEmitter();

/**
 * Helper function to generate unique event ID.
 */
export function generateEventId(): string {
  return `evt-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Helper function to generate unique decision ID.
 */
export function generateDecisionId(): string {
  return `dec-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}
