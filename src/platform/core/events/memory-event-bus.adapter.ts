/**
 * Common Core — In-Memory Event Bus Adapter
 * 
 * High-performance, isolated in-memory implementation of EventBusPort.
 * Provides pub/sub messaging, correlation/causation tracking, and handler cleanup.
 * 
 * @module platform/core/events/memory-event-bus.adapter
 */

import { DomainEventEnvelope, EventBusPort, EventHandler } from './types';

export class MemoryEventBusAdapter implements EventBusPort {
  private handlers = new Map<string, Set<EventHandler<any>>>();

  public async publish<T = unknown>(event: DomainEventEnvelope<T>): Promise<void> {
    const topicHandlers = this.handlers.get(event.eventType);
    if (!topicHandlers || topicHandlers.size === 0) {
      console.log(`[EventBus] No handlers for event: ${event.eventType}`);
      return;
    }

    console.log(`[EventBus] Publishing event: ${event.eventType} (${topicHandlers.size} handlers)`);

    const errors: Error[] = [];
    for (const handler of Array.from(topicHandlers)) {
      try {
        await handler(event);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error(`[EventBus] Handler error for ${event.eventType}:`, error.message);
        errors.push(error);
      }
    }

    if (errors.length > 0) {
      throw new Error(`EventBus dispatch failed for ${event.eventType} with ${errors.length} error(s)`);
    }
  }

  public subscribe<T = unknown>(eventType: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }

    const topicHandlers = this.handlers.get(eventType)!;
    topicHandlers.add(handler);
    console.log(`[EventBus] Subscribed to ${eventType} (${topicHandlers.size} handlers)`);

    return () => {
      topicHandlers.delete(handler);
      console.log(`[EventBus] Unsubscribed from ${eventType}`);
    };
  }

  public clear(): void {
    this.handlers.clear();
  }
}
