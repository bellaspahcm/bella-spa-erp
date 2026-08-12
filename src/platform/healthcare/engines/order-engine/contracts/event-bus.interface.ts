/**
 * Event Bus Abstraction for Clinical Order Service
 * 
 * Implementation will be provided by Host Platform Event Bus (Phase D)
 * For STEP 7: In-memory mock for testing
 * 
 * Invariant: Events MUST be published AFTER DB persistence succeeds
 */

import type { OrderEvent } from '../events/order-events';

export interface EventPublishResult {
  readonly success: boolean;
  readonly eventId?: string;
  readonly error?: string;
}

export interface EventBus {
  /**
   * Publish domain event to event bus
   * 
   * CRITICAL: This method is called AFTER repository.save() succeeds
   * 
   * If publish fails:
   * - Log error
   * - Store in outbox table for retry (Phase D)
   * - DO NOT throw exception to caller
   * - DO NOT rollback DB persistence
   * 
   * @param event Domain event to publish
   * @returns Promise<EventPublishResult>
   */
  publish(event: OrderEvent): Promise<EventPublishResult>;
  
  /**
   * Publish multiple events atomically
   * Best-effort: If one fails, continue with others
   */
  publishBatch(events: OrderEvent[]): Promise<EventPublishResult[]>;

  /**
   * Subscribe to a specific domain event type
   */
  subscribe(eventType: string, handler: (event: OrderEvent) => Promise<void>): void;
}

/**
 * In-memory event bus for testing
 * Phase D: Replace with real Kafka/RabbitMQ integration
 */
export class InMemoryEventBus implements EventBus {
  private events: OrderEvent[] = [];
  private shouldFail = false;
  private subscribers: Map<string, ((event: OrderEvent) => Promise<void>)[]> = new Map();
  
  async publish(event: OrderEvent): Promise<EventPublishResult> {
    if (this.shouldFail) {
      return {
        success: false,
        error: 'Event bus publish failed (simulated)',
      };
    }
    
    this.events.push(event);

    // Call registered subscribers asynchronously
    const handlers = this.subscribers.get(event.eventType) || [];
    for (const handler of handlers) {
      handler(event).catch((err: Error) => {
        console.error(`Error in event subscriber for ${event.eventType}:`, err.message);
      });
    }

    return {
      success: true,
      eventId: event.eventId,
    };
  }
  
  async publishBatch(events: OrderEvent[]): Promise<EventPublishResult[]> {
    return Promise.all(events.map(event => this.publish(event)));
  }

  subscribe(eventType: string, handler: (event: OrderEvent) => Promise<void>): void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, []);
    }
    this.subscribers.get(eventType)!.push(handler);
  }
  
  // Test helpers
  getPublishedEvents(): readonly OrderEvent[] {
    return [...this.events];
  }
  
  getEventsByType<T extends OrderEvent['eventType']>(
    eventType: T
  ): readonly Extract<OrderEvent, { eventType: T }>[] {
    return this.events.filter(e => e.eventType === eventType) as Extract<OrderEvent, { eventType: T }>[];
  }
  
  clear(): void {
    this.events = [];
  }
  
  simulateFailure(shouldFail = true): void {
    this.shouldFail = shouldFail;
  }
}
