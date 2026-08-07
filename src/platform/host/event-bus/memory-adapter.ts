/**
 * Memory Event Bus Adapter
 * For development and testing - events stored in memory
 */

import { EventBusAdapter, DomainEvent, EventHandler, EventType } from './types';

export class MemoryEventBusAdapter implements EventBusAdapter {
  private handlers: Map<EventType, Set<EventHandler>> = new Map();
  private eventLog: DomainEvent[] = []; // For debugging

  async publish(event: DomainEvent): Promise<void> {
    // Store in log
    this.eventLog.push(event);

    // Get handlers for this event type
    const eventHandlers = this.handlers.get(event.eventType);
    
    if (!eventHandlers || eventHandlers.size === 0) {
      console.log(`[EventBus] No handlers for event: ${event.eventType}`);
      return;
    }

    console.log(`[EventBus] Publishing event: ${event.eventType} (${eventHandlers.size} handlers)`);

    // Execute all handlers (in parallel for performance)
    const handlerPromises = Array.from(eventHandlers).map(async (handler) => {
      try {
        await handler(event);
      } catch (error) {
        console.error(`[EventBus] Handler failed for ${event.eventType}:`, error);
        // Don't throw - continue with other handlers
      }
    });

    await Promise.all(handlerPromises);
  }

  subscribe<T = unknown>(
    eventType: EventType,
    handler: EventHandler<T>
  ): () => void {
    // Get or create handler set
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }

    const handlers = this.handlers.get(eventType)!;
    handlers.add(handler as EventHandler);

    console.log(`[EventBus] Subscribed to ${eventType} (${handlers.size} handlers)`);

    // Return unsubscribe function
    return () => {
      handlers.delete(handler as EventHandler);
      console.log(`[EventBus] Unsubscribed from ${eventType}`);
    };
  }

  // Debug methods
  getEventLog(): DomainEvent[] {
    return [...this.eventLog];
  }

  getHandlerCount(eventType: EventType): number {
    return this.handlers.get(eventType)?.size || 0;
  }

  clear(): void {
    this.handlers.clear();
    this.eventLog = [];
  }
}
