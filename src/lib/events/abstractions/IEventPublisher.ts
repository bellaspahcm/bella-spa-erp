/**
 * Event Publisher Interface
 * 
 * Abstraction cho event publishing/subscription. Cho phép thay đổi event
 * transport layer (InMemory, Redis, RabbitMQ, Kafka) mà không ảnh hưởng
 * business logic.
 * 
 * @example
 * ```typescript
 * class InMemoryEventPublisher implements IEventPublisher {
 *   readonly name = 'in-memory';
 *   
 *   async publish(event: DomainEvent) {
 *     // Synchronous in-process delivery
 *     this.handlers.forEach(h => h(event));
 *   }
 *   
 *   subscribe(pattern: string, handler: EventHandler) {
 *     this.handlers.push(handler);
 *     return () => { unsubscribe logic };
 *   }
 * }
 * ```
 */

/**
 * Domain event structure
 */
export interface DomainEvent<T = unknown> {
  /** Unique event ID */
  id: string;
  
  /** Event type (e.g., 'booking.created', 'payment.completed') */
  type: string;
  
  /** Event payload data */
  data: T;
  
  /** Timestamp when event occurred */
  timestamp: Date;
  
  /** Tenant context */
  tenantId: string;
  
  /** User who triggered event (optional) */
  userId?: string;
  
  /** Correlation ID for tracing (optional) */
  correlationId?: string;
  
  /** Event metadata */
  metadata?: Record<string, unknown>;
  
  /** Event version (for schema evolution) */
  version?: string;
}

/**
 * Event handler function type
 */
export type EventHandler<T = unknown> = (event: DomainEvent<T>) => void | Promise<void>;

/**
 * Unsubscribe function returned by subscribe()
 */
export type Unsubscribe = () => void;

/**
 * Event subscription configuration
 */
export interface SubscriptionConfig {
  /** Event pattern to match (supports wildcards: 'booking.*', '*.created') */
  pattern: string;
  
  /** Handler function */
  handler: EventHandler;
  
  /** Subscription name (for debugging) */
  name?: string;
  
  /** Whether to handle events in order (default: false) */
  ordered?: boolean;
  
  /** Max retry attempts on failure (default: 0) */
  maxRetries?: number;
  
  /** Retry delay in ms (default: 1000) */
  retryDelay?: number;
}

/**
 * Event publishing options
 */
export interface PublishOptions {
  /** Whether to wait for all handlers to complete (default: false) */
  waitForHandlers?: boolean;
  
  /** Timeout in ms for waiting (default: 5000) */
  timeout?: number;
  
  /** Whether to throw on handler errors (default: false) */
  throwOnError?: boolean;
}

/**
 * Event Publisher Interface
 * 
 * Core abstraction for event publishing and subscription. All event publishers
 * must implement this interface.
 * 
 * Design principles:
 * - Async: All operations are async to support I/O
 * - Pattern matching: Support wildcard patterns for subscriptions
 * - Reliable: Handle errors gracefully, support retries
 * - Observable: Emit metrics and logs for monitoring
 * - Pluggable: Easy to swap implementations (InMemory → Redis → Kafka)
 */
export interface IEventPublisher {
  /**
   * Publisher unique name (e.g., 'in-memory', 'redis', 'rabbitmq')
   */
  readonly name: string;
  
  /**
   * Publisher version (semver format)
   */
  readonly version?: string;
  
  /**
   * Publish an event
   * 
   * @param event - Domain event to publish
   * @param options - Publishing options
   * @returns Promise that resolves when event is published
   * @throws Error if publishing fails critically
   * 
   * @example
   * ```typescript
   * await publisher.publish({
   *   id: 'evt-123',
   *   type: 'booking.created',
   *   data: { bookingId: '456', customerId: '789' },
   *   timestamp: new Date(),
   *   tenantId: 'tenant-1'
   * });
   * ```
   */
  publish<T = unknown>(event: DomainEvent<T>, options?: PublishOptions): Promise<void>;
  
  /**
   * Subscribe to events matching a pattern
   * 
   * Pattern matching rules:
   * - Exact match: 'booking.created'
   * - Wildcard suffix: 'booking.*' (matches booking.created, booking.updated, etc.)
   * - Wildcard prefix: '*.created' (matches booking.created, payment.created, etc.)
   * - Multiple wildcards: 'booking.*.completed'
   * 
   * @param pattern - Event type pattern to match
   * @param handler - Function to handle matching events
   * @returns Unsubscribe function
   * 
   * @example
   * ```typescript
   * const unsubscribe = publisher.subscribe('booking.*', async (event) => {
   *   console.log('Booking event:', event.type, event.data);
   * });
   * 
   * // Later: unsubscribe();
   * ```
   */
  subscribe<T = unknown>(pattern: string, handler: EventHandler<T>): Unsubscribe;
  
  /**
   * Subscribe with configuration
   * 
   * @param config - Subscription configuration
   * @returns Unsubscribe function
   * 
   * @example
   * ```typescript
   * const unsubscribe = publisher.subscribeWithConfig({
   *   pattern: 'payment.*',
   *   handler: async (event) => { /* handler code *\/ },
   *   name: 'payment-processor',
   *   ordered: true,
   *   maxRetries: 3,
   *   retryDelay: 2000
   * });
   * ```
   */
  subscribeWithConfig<T = unknown>(config: SubscriptionConfig): Unsubscribe;
  
  /**
   * Close publisher and cleanup resources
   * 
   * Should be called on application shutdown to:
   * - Close connections (Redis, RabbitMQ, Kafka)
   * - Flush pending events
   * - Unsubscribe all handlers
   * 
   * @example
   * ```typescript
   * process.on('SIGTERM', async () => {
   *   await publisher.close();
   * });
   * ```
   */
  close(): Promise<void>;
  
  /**
   * Check if publisher is healthy (optional)
   * 
   * Used for health checks and monitoring.
   * 
   * @returns true if publisher is operational
   */
  isHealthy?(): Promise<boolean>;
  
  /**
   * Get publisher statistics (optional)
   * 
   * Used for monitoring and debugging.
   * 
   * @returns Statistics object
   */
  getStats?(): Promise<PublisherStats>;
}

/**
 * Publisher statistics
 */
export interface PublisherStats {
  /** Total events published */
  eventsPublished: number;
  
  /** Total events received by subscribers */
  eventsReceived: number;
  
  /** Total subscription handlers */
  subscriptionCount: number;
  
  /** Total errors encountered */
  errorCount: number;
  
  /** Average publish latency in ms */
  avgPublishLatency?: number;
  
  /** Additional custom stats */
  [key: string]: unknown;
}

/**
 * Helper function to create domain event
 * 
 * @example
 * ```typescript
 * const event = createDomainEvent({
 *   type: 'booking.created',
 *   data: { bookingId: '123' },
 *   tenantId: 'tenant-1'
 * });
 * ```
 */
export function createDomainEvent<T = unknown>(
  partial: Omit<DomainEvent<T>, 'id' | 'timestamp'> & { id?: string; timestamp?: Date }
): DomainEvent<T> {
  return {
    id: partial.id ?? crypto.randomUUID(),
    timestamp: partial.timestamp ?? new Date(),
    ...partial
  };
}

/**
 * Helper function to match event type against pattern
 * 
 * @example
 * ```typescript
 * matchPattern('booking.created', 'booking.*') // true
 * matchPattern('booking.created', '*.created') // true
 * matchPattern('booking.created', 'payment.*') // false
 * ```
 */
export function matchPattern(eventType: string, pattern: string): boolean {
  if (pattern === '*') return true;
  if (pattern === eventType) return true;
  
  const regex = new RegExp(
    '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '[^.]+') + '$'
  );
  return regex.test(eventType);
}

/**
 * Base event publisher class with common functionality
 * 
 * @example
 * ```typescript
 * class MyPublisher extends BaseEventPublisher {
 *   readonly name = 'my-publisher';
 *   
 *   async publish(event: DomainEvent) {
 *     this.incrementPublishCount();
 *     // Implementation
 *   }
 * }
 * ```
 */
export abstract class BaseEventPublisher implements IEventPublisher {
  abstract readonly name: string;
  readonly version?: string;
  
  protected subscriptions: Map<string, SubscriptionConfig[]> = new Map();
  protected stats = {
    eventsPublished: 0,
    eventsReceived: 0,
    errorCount: 0
  };
  
  abstract publish<T = unknown>(event: DomainEvent<T>, options?: PublishOptions): Promise<void>;
  abstract close(): Promise<void>;
  
  /**
   * Default subscribe implementation using subscribeWithConfig
   */
  subscribe<T = unknown>(pattern: string, handler: EventHandler<T>): Unsubscribe {
    return this.subscribeWithConfig({ pattern, handler: handler as EventHandler });
  }
  
  /**
   * Default subscribeWithConfig implementation
   */
  subscribeWithConfig<T = unknown>(config: SubscriptionConfig): Unsubscribe {
    const existing = this.subscriptions.get(config.pattern) || [];
    existing.push(config);
    this.subscriptions.set(config.pattern, existing);
    
    return () => {
      const subs = this.subscriptions.get(config.pattern) || [];
      const index = subs.indexOf(config);
      if (index > -1) {
        subs.splice(index, 1);
      }
    };
  }
  
  /**
   * Get matching handlers for an event
   */
  protected getMatchingHandlers<T = unknown>(event: DomainEvent<T>): EventHandler<T>[] {
    const handlers: EventHandler<T>[] = [];
    
    for (const [pattern, configs] of this.subscriptions.entries()) {
      if (matchPattern(event.type, pattern)) {
        handlers.push(...configs.map(c => c.handler as EventHandler<T>));
      }
    }
    
    return handlers;
  }
  
  /**
   * Helper: Increment publish count
   */
  protected incrementPublishCount(): void {
    this.stats.eventsPublished++;
  }
  
  /**
   * Helper: Increment receive count
   */
  protected incrementReceiveCount(): void {
    this.stats.eventsReceived++;
  }
  
  /**
   * Helper: Increment error count
   */
  protected incrementErrorCount(): void {
    this.stats.errorCount++;
  }
  
  /**
   * Default stats implementation
   */
  async getStats(): Promise<PublisherStats> {
    return {
      ...this.stats,
      subscriptionCount: Array.from(this.subscriptions.values()).flat().length
    };
  }
  
  /**
   * Default health check
   */
  async isHealthy(): Promise<boolean> {
    return true;
  }
}

/**
 * Event publisher registry for managing multiple publishers
 * 
 * @example
 * ```typescript
 * const registry = new EventPublisherRegistry();
 * registry.register(new InMemoryEventPublisher());
 * registry.register(new RedisEventPublisher());
 * 
 * const publisher = registry.getPublisher('redis');
 * await publisher.publish(event);
 * ```
 */
export class EventPublisherRegistry {
  private publishers: Map<string, IEventPublisher> = new Map();
  private defaultPublisher?: IEventPublisher;
  
  /**
   * Register a new publisher
   * @param setAsDefault - Set this publisher as default
   */
  register(publisher: IEventPublisher, setAsDefault = false): void {
    if (this.publishers.has(publisher.name)) {
      throw new Error(`Publisher '${publisher.name}' already registered`);
    }
    this.publishers.set(publisher.name, publisher);
    
    if (setAsDefault || this.publishers.size === 1) {
      this.defaultPublisher = publisher;
    }
  }
  
  /**
   * Get publisher by name
   */
  getPublisher(name: string): IEventPublisher {
    const publisher = this.publishers.get(name);
    if (!publisher) {
      throw new Error(`Publisher not found: ${name}`);
    }
    return publisher;
  }
  
  /**
   * Get default publisher
   */
  getDefaultPublisher(): IEventPublisher {
    if (!this.defaultPublisher) {
      throw new Error('No default publisher set');
    }
    return this.defaultPublisher;
  }
  
  /**
   * Close all publishers
   */
  async closeAll(): Promise<void> {
    await Promise.all(
      Array.from(this.publishers.values()).map(p => p.close())
    );
  }
}
