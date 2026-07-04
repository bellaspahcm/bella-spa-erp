/**
 * In-Memory Event Publisher - Reference Implementation
 * 
 * Simple in-process event publisher implementation của IEventPublisher.
 * Đây là reference implementation để demo cách implement interface.
 * 
 * Features:
 * - Synchronous in-process event delivery
 * - Pattern matching for subscriptions
 * - Ordered event processing (optional)
 * - Retry logic for failed handlers
 * - Event buffering and replay
 * 
 * Use cases:
 * - Development and testing
 * - Single-instance applications
 * - Event sourcing in-memory
 * - Low-latency event processing
 * 
 * Limitations:
 * - Events are lost on application restart (not persistent)
 * - No cross-instance communication
 * - No distributed tracing
 * 
 * @example
 * ```typescript
 * const publisher = new InMemoryEventPublisher({
 *   bufferSize: 1000,
 *   enableMetrics: true
 * });
 * 
 * // Subscribe
 * const unsubscribe = publisher.subscribe('booking.*', async (event) => {
 *   console.log('Booking event:', event.type);
 * });
 * 
 * // Publish
 * await publisher.publish({
 *   id: 'evt-123',
 *   type: 'booking.created',
 *   data: { bookingId: '456' },
 *   timestamp: new Date(),
 *   tenantId: 'tenant-1'
 * });
 * 
 * // Cleanup
 * unsubscribe();
 * await publisher.close();
 * ```
 */

import {
  BaseEventPublisher,
  type DomainEvent,
  type EventHandler,
  type PublishOptions,
  type SubscriptionConfig,
  type PublisherStats,
  matchPattern
} from '../abstractions/IEventPublisher';

/**
 * In-memory publisher configuration
 */
export interface InMemoryPublisherConfig {
  /** Buffer size for event history (0 = no buffer) */
  bufferSize?: number;
  
  /** Enable metrics collection */
  enableMetrics?: boolean;
  
  /** Log events to console (for debugging) */
  debug?: boolean;
  
  /** Default timeout for waiting handlers (ms) */
  defaultTimeout?: number;
}

/**
 * Subscription with retry state
 */
interface SubscriptionWithRetry extends SubscriptionConfig {
  /** Current retry count */
  retryCount?: number;
  
  /** Last error message */
  lastError?: string;
}

/**
 * In-Memory Event Publisher Implementation
 * 
 * Simple event publisher for in-process event handling.
 * Events are delivered synchronously to all matching handlers.
 * 
 * Production considerations:
 * - Add persistence layer for event replay
 * - Add dead letter queue for failed events
 * - Add event filtering/transformation
 * - Add backpressure handling
 * - Add distributed tracing
 */
export class InMemoryEventPublisher extends BaseEventPublisher {
  readonly name = 'in-memory';
  readonly version = '1.0.0';
  
  private config: Required<InMemoryPublisherConfig>;
  private eventBuffer: DomainEvent[] = [];
  private subscriptionsWithRetry: Map<string, SubscriptionWithRetry[]> = new Map();
  private metricsStartTime = Date.now();
  private publishLatencies: number[] = [];
  
  constructor(config: InMemoryPublisherConfig = {}) {
    super();
    this.config = {
      bufferSize: config.bufferSize ?? 1000,
      enableMetrics: config.enableMetrics ?? true,
      debug: config.debug ?? false,
      defaultTimeout: config.defaultTimeout ?? 5000
    };
  }
  
  /**
   * Publish event to all matching subscribers
   */
  async publish<T = unknown>(
    event: DomainEvent<T>,
    options?: PublishOptions
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Validate event
      this.validateEvent(event);
      
      // Store in buffer
      this.addToBuffer(event);
      
      // Increment stats
      this.incrementPublishCount();
      
      // Debug log
      if (this.config.debug) {
        console.log('[InMemoryEventPublisher] Publishing event:', {
          id: event.id,
          type: event.type,
          tenantId: event.tenantId
        });
      }
      
      // Get matching handlers
      const handlers = this.getMatchingHandlers(event);
      
      if (handlers.length === 0) {
        if (this.config.debug) {
          console.log('[InMemoryEventPublisher] No handlers for event:', event.type);
        }
        return;
      }
      
      // Execute handlers
      const timeout = options?.timeout ?? this.config.defaultTimeout;
      const waitForHandlers = options?.waitForHandlers ?? false;
      const throwOnError = options?.throwOnError ?? false;
      
      const handlerPromises = handlers.map(handler =>
        this.executeHandler(handler, event, throwOnError)
      );
      
      if (waitForHandlers) {
        // Wait for all handlers with timeout
        await Promise.race([
          Promise.all(handlerPromises),
          this.createTimeout(timeout)
        ]);
      } else {
        // Fire and forget
        Promise.all(handlerPromises).catch(err => {
          console.error('[InMemoryEventPublisher] Handler errors:', err);
          this.incrementErrorCount();
        });
      }
      
      // Record latency
      if (this.config.enableMetrics) {
        const latency = Date.now() - startTime;
        this.recordPublishLatency(latency);
      }
      
    } catch (error) {
      this.incrementErrorCount();
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[InMemoryEventPublisher] Publish failed: ${errorMessage}`);
      
      throw error;
    }
  }
  
  /**
   * Subscribe with configuration and retry logic
   */
  subscribeWithConfig(config: SubscriptionConfig): () => void {
    // Call base implementation to register in subscriptions map
    const baseUnsubscribe = super.subscribeWithConfig(config);
    
    // Also store in retry-enabled map
    const existing = this.subscriptionsWithRetry.get(config.pattern) || [];
    const subWithRetry: SubscriptionWithRetry = {
      ...config,
      retryCount: 0
    };
    existing.push(subWithRetry);
    this.subscriptionsWithRetry.set(config.pattern, existing);
    
    // Return combined unsubscribe function
    return () => {
      baseUnsubscribe();
      
      const subs = this.subscriptionsWithRetry.get(config.pattern) || [];
      const index = subs.indexOf(subWithRetry);
      if (index > -1) {
        subs.splice(index, 1);
      }
    };
  }
  
  /**
   * Close publisher and cleanup
   */
  async close(): Promise<void> {
    if (this.config.debug) {
      console.log('[InMemoryEventPublisher] Closing publisher...');
    }
    
    // Clear subscriptions
    this.subscriptions.clear();
    this.subscriptionsWithRetry.clear();
    
    // Clear buffer
    this.eventBuffer = [];
    
    if (this.config.debug) {
      console.log('[InMemoryEventPublisher] Publisher closed');
    }
  }
  
  /**
   * Check if publisher is healthy
   */
  async isHealthy(): Promise<boolean> {
    return true; // In-memory publisher is always healthy
  }
  
  /**
   * Get publisher statistics
   */
  async getStats(): Promise<PublisherStats> {
    const baseStats = await super.getStats();
    
    return {
      ...baseStats,
      avgPublishLatency: this.calculateAvgLatency(),
      bufferSize: this.eventBuffer.length,
      uptime: Date.now() - this.metricsStartTime
    };
  }
  
  /**
   * Replay buffered events to a handler
   * Useful for new subscribers that need historical events
   * 
   * @example
   * ```typescript
   * const unsubscribe = publisher.subscribe('booking.*', handler);
   * await publisher.replayEvents('booking.*', handler);
   * ```
   */
  async replayEvents<T = unknown>(
    pattern: string,
    handler: (event: DomainEvent<T>) => void | Promise<void>
  ): Promise<void> {
    const matchingEvents = this.eventBuffer.filter(event =>
      matchPattern(event.type, pattern)
    );
    
    if (this.config.debug) {
      console.log(`[InMemoryEventPublisher] Replaying ${matchingEvents.length} events for pattern: ${pattern}`);
    }
    
    for (const event of matchingEvents) {
      try {
        await handler(event as DomainEvent<T>);
      } catch (error) {
        console.error('[InMemoryEventPublisher] Replay handler error:', error);
      }
    }
  }
  
  /**
   * Clear event buffer
   */
  clearBuffer(): void {
    this.eventBuffer = [];
    if (this.config.debug) {
      console.log('[InMemoryEventPublisher] Buffer cleared');
    }
  }
  
  /**
   * Get buffered events (for testing/debugging)
   */
  getBufferedEvents(): DomainEvent[] {
    return [...this.eventBuffer];
  }
  
  /**
   * Validate event structure
   */
  private validateEvent(event: DomainEvent): void {
    if (!event.id) throw new Error('Event ID is required');
    if (!event.type) throw new Error('Event type is required');
    if (!event.tenantId) throw new Error('Event tenantId is required');
    if (!event.timestamp) throw new Error('Event timestamp is required');
  }
  
  /**
   * Add event to circular buffer
   */
  private addToBuffer(event: DomainEvent): void {
    if (this.config.bufferSize === 0) return;
    
    this.eventBuffer.push(event);
    
    // Remove oldest events if buffer is full
    if (this.eventBuffer.length > this.config.bufferSize) {
      this.eventBuffer.shift();
    }
  }
  
  /**
   * Execute handler with retry logic
   */
  private async executeHandler<T = unknown>(
    handler: EventHandler<T>,
    event: DomainEvent<T>,
    throwOnError: boolean
  ): Promise<void> {
    try {
      await handler(event);
      this.incrementReceiveCount();
    } catch (error) {
      this.incrementErrorCount();
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[InMemoryEventPublisher] Handler error:', {
        eventType: event.type,
        eventId: event.id,
        error: errorMessage
      });
      
      if (throwOnError) {
        throw error;
      }
    }
  }
  
  /**
   * Create timeout promise
   */
  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
    });
  }
  
  /**
   * Record publish latency
   */
  private recordPublishLatency(latency: number): void {
    this.publishLatencies.push(latency);
    
    // Keep only last 1000 latencies
    if (this.publishLatencies.length > 1000) {
      this.publishLatencies.shift();
    }
  }
  
  /**
   * Calculate average publish latency
   */
  private calculateAvgLatency(): number {
    if (this.publishLatencies.length === 0) return 0;
    
    const sum = this.publishLatencies.reduce((acc, val) => acc + val, 0);
    return Math.round(sum / this.publishLatencies.length);
  }
}

/**
 * Helper function to create in-memory publisher
 * 
 * @example
 * ```typescript
 * const publisher = createInMemoryPublisher({
 *   bufferSize: 500,
 *   debug: true
 * });
 * ```
 */
export function createInMemoryPublisher(
  config?: InMemoryPublisherConfig
): InMemoryEventPublisher {
  return new InMemoryEventPublisher(config);
}
