import { ResourceEvent } from './types';

export type EventSubscriber = (event: ResourceEvent) => void | Promise<void>;

/**
 * Enterprise Event Bus for Bella EIP Capabilities
 */
export class EventBus {
  private static instance: EventBus;
  private subscribers: Map<string, Set<EventSubscriber>> = new Map();
  private auditLog: ResourceEvent[] = [];

  private constructor() {}

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  public subscribe(eventType: string, subscriber: EventSubscriber): () => void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    this.subscribers.get(eventType)!.add(subscriber);

    return () => {
      this.subscribers.get(eventType)?.delete(subscriber);
    };
  }

  public async publish(event: ResourceEvent): Promise<void> {
    this.auditLog.unshift(event);
    const handlers = this.subscribers.get(event.eventType);

    if (handlers) {
      for (const handler of handlers) {
        try {
          await handler(event);
        } catch (err: unknown) {
          console.error(`[EventBus Error] Failed handler for event ${event.eventType}:`, err);
        }
      }
    }
  }

  public getEventHistory(resourceType?: string, resourceId?: string): ResourceEvent[] {
    return this.auditLog.filter(e => {
      const matchType = !resourceType || e.resourceType === resourceType;
      const matchId = !resourceId || e.resourceId === resourceId;
      return matchType && matchId;
    });
  }
}

export const eventBus = EventBus.getInstance();
