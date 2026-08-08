/**
 * Event Bus Service
 * Platform-of-Platforms: Host Platform
 * Constitution: Law 5 (Event-Driven Communication)
 */

import { EventBusAdapter, DomainEvent, EventHandler, EventType } from './types';
import { MemoryEventBusAdapter } from './memory-adapter';

class EventBusService {
  private adapter: EventBusAdapter;

  constructor(adapter?: EventBusAdapter) {
    // Default to memory adapter (can be swapped to Redis in production)
    this.adapter = adapter || new MemoryEventBusAdapter();
  }

  /**
   * Publish a domain event
   */
  async publish<T = unknown>(params: {
    eventType: EventType;
    eventVersion?: string;
    tenantId: string;
    aggregateId: string;
    aggregateType: string;
    payload: T;
    userId?: string;
    correlationId?: string;
    causationId?: string;
  }): Promise<void> {
    const event: DomainEvent<T> = {
      eventId: crypto.randomUUID(),
      eventType: params.eventType,
      eventVersion: params.eventVersion || (params.eventType.endsWith('.v1') ? 'v1' : '1.0'),
      tenantId: params.tenantId,
      aggregateId: params.aggregateId,
      aggregateType: params.aggregateType,

      payload: params.payload,
      occurredAt: new Date().toISOString(),
      userId: params.userId,
      correlationId: params.correlationId,
      causationId: params.causationId,
    };

    await this.adapter.publish(event);
  }

  /**
   * Subscribe to an event type
   */
  subscribe<T = unknown>(
    eventType: EventType,
    handler: EventHandler<T>
  ): () => void {
    return this.adapter.subscribe(eventType, handler);
  }

  /**
   * Subscribe to multiple event types with the same handler
   */
  subscribeToMany<T = unknown>(
    eventTypes: EventType[],
    handler: EventHandler<T>
  ): () => void {
    const unsubscribers = eventTypes.map((type) =>
      this.adapter.subscribe(type, handler)
    );

    // Return function that unsubscribes from all
    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }

  /**
   * Swap adapter (e.g., from memory to Redis)
   */
  setAdapter(adapter: EventBusAdapter): void {
    this.adapter = adapter;
  }

  /**
   * Get current adapter (for debugging)
   */
  getAdapter(): EventBusAdapter {
    return this.adapter;
  }
}

// Singleton instance
export const eventBus = new EventBusService();
