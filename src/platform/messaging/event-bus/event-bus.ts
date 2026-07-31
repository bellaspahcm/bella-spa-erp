export interface SystemEvent<T = unknown> {
  id: string;
  name: string;
  timestamp: string;
  tenantId?: string;
  payload: T;
}

type SystemEventHandler<T = unknown> = (event: SystemEvent<T>) => void | Promise<void>;

/**
 * BELLA EIP System Event Bus (Phase 1)
 * Used strictly for cross-cutting telemetry: Notifications, Audit Logging, Cache Eviction, Webhooks.
 */
class EventBus {
  private handlers: Map<string, SystemEventHandler<unknown>[]> = new Map();

  subscribe<T = unknown>(eventName: string, handler: SystemEventHandler<T>): () => void {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, []);
    }
    this.handlers.get(eventName)!.push(handler as SystemEventHandler<unknown>);

    return () => {
      const list = this.handlers.get(eventName);
      if (list) {
        this.handlers.set(eventName, list.filter(h => h !== (handler as SystemEventHandler<unknown>)));
      }
    };
  }

  async publish<T = unknown>(event: SystemEvent<T>): Promise<void> {
    const list = this.handlers.get(event.name) || [];
    for (const handler of list) {
      try {
        await handler(event as SystemEvent<unknown>);
      } catch (err) {
        console.error('[EventBus] Error handling event %s:', event.name, err);
      }
    }
  }
}

export const eventBus = new EventBus();

