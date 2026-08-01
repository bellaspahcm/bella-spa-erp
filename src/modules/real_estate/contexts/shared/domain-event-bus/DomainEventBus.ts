import { eventBus } from '@/platform/capability-platform/event-bus';
import { ResourceEvent } from '@/platform/capability-platform/types';
import { DomainEvent } from './DomainEvent';

export type DomainEventSubscriber = (event: DomainEvent) => void | Promise<void>;

export class DomainEventBus {
  private static instance: DomainEventBus;
  private subscribers: Map<string, Set<DomainEventSubscriber>> = new Map();

  private constructor() {
    // Listen to the platform EventBus and route relevant events back to local subscribers
    // We use a wildcard/generic subscriber on the platform bus to capture all events
    // Wait, the platform EventBus doesn't support wildcard subscribe easily, but we can intercept.
    // However, the cleanest way is: when local DomainEventBus.publish is called, it:
    // 1. Invokes local subscribers immediately (in-process sync bus)
    // 2. Publishes to the platform EventBus for cross-cutting platform concerns (workflows, notifications, audit logs)
  }

  public static getInstance(): DomainEventBus {
    if (!DomainEventBus.instance) {
      DomainEventBus.instance = new DomainEventBus();
    }
    return DomainEventBus.instance;
  }

  public subscribe(eventType: string, subscriber: DomainEventSubscriber): () => void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    this.subscribers.get(eventType)!.add(subscriber);

    return () => {
      this.subscribers.get(eventType)?.delete(subscriber);
    };
  }

  public async publish(event: DomainEvent): Promise<void> {
    // 1. Dispatch to local context subscribers (synchronously/in-process first)
    const handlers = this.subscribers.get(event.eventType);
    if (handlers) {
      for (const handler of handlers) {
        try {
          await handler(event);
        } catch (err) {
          console.error(
            `[DomainEventBus Error] Failed handler for event %s:`,
            event.eventType,
            err
          );
          // In domain-driven events, we propagate errors to halt transaction if it's a critical handler,
          // or we catch it if it's a non-critical side effect. For safe default: re-throw.
          throw err;
        }
      }
    }

    // 2. Bridge to the platform event bus for global notifications, workflows, audit logs, projections
    const resourceEvent: ResourceEvent = {
      id: event.eventId,
      resourceType: event.aggregateType,
      resourceId: event.aggregateId,
      eventType: event.eventType,
      actorId: (event.payload.actorId as string) || 'system',
      actorName: (event.payload.actorName as string) || 'System',
      payload: {
        ...event.payload,
        __tenantId: event.tenantId,
        __version: event.version,
        __correlationId: event.correlationId,
        __causationId: event.causationId,
        __occurredAt: event.occurredAt.toISOString(),
      },
      timestamp: event.occurredAt.toISOString(),
    };

    await eventBus.publish(resourceEvent);
  }
}

export const domainEventBus = DomainEventBus.getInstance();
