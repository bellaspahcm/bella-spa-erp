/**
 * Decision Engine Metrics Collector (Platform Service)
 * 
 * ARCHITECTURE PRINCIPLE:
 * - Domain-agnostic: Works for ALL providers (Booking, Payroll, Commission, Inventory, etc.)
 * - Non-blocking: Metrics emission never blocks provider execution
 * - Fire-and-forget: Failed metrics don't fail business operations
 * - Centralized: Single place for all metrics emission logic
 * 
 * USAGE:
 * Providers should NOT call this directly. Use DecisionEngineContext wrapper instead.
 * 
 * @example
 * // ❌ WRONG: Provider calls MetricsCollector directly
 * await provider.evaluate();
 * MetricsCollector.emit({ ... });
 * 
 * // ✅ RIGHT: DecisionEngineContext wraps provider automatically
 * const result = await context.execute(provider, input);
 * // Metrics emitted automatically ^^^
 */

// ============================================================================
// Types
// ============================================================================

export type ProviderType =
  // Booking Domain
  | 'capacity_management'
  | 'auto_assignment'
  | 'conflict_detection'
  | 'waitlist'
  | 'pricing'
  | 'cancellation'
  // Payroll Domain
  | 'payroll_kpi_bonus'
  | 'payroll_deduction'
  | 'payroll_commission'
  // Discount Domain
  | 'discount_eligibility'
  | 'discount_calculation'
  // Commission Domain
  | 'commission_calculation'
  | 'commission_tier'
  // Inventory Domain
  | 'inventory_reorder'
  | 'inventory_allocation'
  | 'inventory_expiry'
  // Future: Add more as providers are built
  | string; // Allow extensibility

export interface MetricEvent {
  // Provider Info
  providerType: ProviderType;
  operation: string; // e.g., 'evaluate', 'checkCapacity', 'assignKtv', 'calculateBonus'
  
  // Execution Result
  success: boolean;
  outcome?: string; // e.g., 'available', 'full', 'assigned', 'conflict_blocked', 'approved', 'rejected'
  
  // Performance
  executionTimeMs: number;
  
  // Context (domain-specific, optional)
  context?: {
    tenantId?: string;
    userId?: string;
    entityId?: string; // booking_id, salary_record_id, order_id, etc.
    customerId?: string;
    ktvId?: string;
    // Add more as needed
  };
  
  // Additional Data (JSONB, flexible)
  metadata?: Record<string, unknown>;
  
  // Override Flags (for reporting manager bypasses)
  skipFlags?: {
    [key: string]: boolean; // e.g., { capacity: true, conflict: false }
  };
}

export interface MetricsCollectorConfig {
  // API endpoint (defaults to /api/admin/booking-engine/metrics)
  // TODO: Rename to /api/admin/decision-engine/metrics (platform-level)
  endpoint?: string;
  
  // Retry config
  maxRetries?: number;
  retryDelayMs?: number;
  
  // Batching config (future optimization)
  batchSize?: number;
  batchIntervalMs?: number;
  
  // Enable/disable (useful for testing)
  enabled?: boolean;
}

// ============================================================================
// MetricsCollector Class
// ============================================================================

export class MetricsCollector {
  private static config: MetricsCollectorConfig = {
    endpoint: '/api/admin/booking-engine/metrics', // TODO: Rename to decision-engine
    maxRetries: 2,
    retryDelayMs: 1000,
    batchSize: 1, // No batching yet (emit immediately)
    batchIntervalMs: 5000,
    enabled: true,
  };

  private static queue: MetricEvent[] = [];
  private static isProcessing = false;

  /**
   * Configure MetricsCollector (call once at app startup)
   */
  static configure(config: Partial<MetricsCollectorConfig>): void {
    MetricsCollector.config = {
      ...MetricsCollector.config,
      ...config,
    };
  }

  /**
   * Emit a metric event (fire-and-forget, non-blocking)
   * 
   * This is the ONLY public method providers should use (via DecisionEngineContext).
   * 
   * @param event - Metric event to emit
   * @returns Promise<void> - Always resolves (never rejects)
   */
  static async emit(event: MetricEvent): Promise<void> {
    if (!MetricsCollector.config.enabled) {
      return; // Metrics disabled
    }

    try {
      // Add to queue
      MetricsCollector.queue.push(event);

      // Process queue (non-blocking)
      void MetricsCollector.processQueue();
    } catch (error) {
      // Never throw - metrics should never crash the app
      console.error('[MetricsCollector] Failed to enqueue metric:', error);
    }
  }

  /**
   * Process queued metrics (internal)
   * 
   * Uses fire-and-forget pattern:
   * - Non-blocking (doesn't await fetch)
   * - Catches errors (doesn't propagate)
   * - Retries on failure (with exponential backoff)
   */
  private static async processQueue(): Promise<void> {
    if (MetricsCollector.isProcessing || MetricsCollector.queue.length === 0) {
      return;
    }

    MetricsCollector.isProcessing = true;

    try {
      // Take batch from queue
      const batchSize = MetricsCollector.config.batchSize || 1;
      const batch = MetricsCollector.queue.splice(0, batchSize);

      // Send each metric (for now, no batching - send individually)
      for (const event of batch) {
        await MetricsCollector.sendMetric(event);
      }
    } catch (error) {
      console.error('[MetricsCollector] Failed to process queue:', error);
    } finally {
      MetricsCollector.isProcessing = false;

      // If more items in queue, process next batch
      if (MetricsCollector.queue.length > 0) {
        setTimeout(() => {
          void MetricsCollector.processQueue();
        }, 100);
      }
    }
  }

  /**
   * Send a single metric to API (with retries)
   */
  private static async sendMetric(event: MetricEvent, retryCount = 0): Promise<void> {
    try {
      const response = await fetch(MetricsCollector.config.endpoint!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          providerType: event.providerType,
          operation: event.operation,
          success: event.success,
          outcome: event.outcome,
          executionTimeMs: event.executionTimeMs,
          bookingId: event.context?.entityId, // Map generic entityId to specific field
          customerId: event.context?.customerId,
          ktvId: event.context?.ktvId,
          metadata: event.metadata,
          skipFlags: event.skipFlags,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Success - metric sent
      return;
    } catch (error) {
      const maxRetries = MetricsCollector.config.maxRetries || 0;

      if (retryCount < maxRetries) {
        // Retry with exponential backoff
        const delayMs = MetricsCollector.config.retryDelayMs! * Math.pow(2, retryCount);
        
        console.warn(
          `[MetricsCollector] Retry ${retryCount + 1}/${maxRetries} after ${delayMs}ms:`,
          error
        );

        await new Promise(resolve => setTimeout(resolve, delayMs));
        return MetricsCollector.sendMetric(event, retryCount + 1);
      }

      // Max retries reached - log and drop metric
      console.error(
        '[MetricsCollector] Failed to send metric after retries:',
        error,
        event
      );
    }
  }

  /**
   * Flush all pending metrics (useful for graceful shutdown)
   */
  static async flush(): Promise<void> {
    while (MetricsCollector.queue.length > 0) {
      await MetricsCollector.processQueue();
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Get queue size (for monitoring)
   */
  static getQueueSize(): number {
    return MetricsCollector.queue.length;
  }

  /**
   * Clear queue (for testing)
   */
  static clearQueue(): void {
    MetricsCollector.queue = [];
  }
}

// ============================================================================
// Helper: Measure execution time
// ============================================================================

/**
 * Measure execution time of a provider function
 * 
 * @example
 * const [result, executionTimeMs] = await measureExecutionTime(async () => {
 *   return await provider.evaluate(input);
 * });
 */
export async function measureExecutionTime<T>(
  fn: () => Promise<T>
): Promise<[T, number]> {
  const startTime = performance.now();
  const result = await fn();
  const executionTimeMs = performance.now() - startTime;
  return [result, executionTimeMs];
}

// ============================================================================
// Exports
// ============================================================================

export default MetricsCollector;
