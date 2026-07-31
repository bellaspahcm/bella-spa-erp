export interface SystemEvent<T = any> {
  id: string;
  name: string;
  timestamp: string;
  tenantId?: string;
  payload: T;
}

type SystemEventHandler<T = any> = (event: SystemEvent<T>) => void | Promise<void>;

/**
 * BELLA EIP System Event Bus (Phase 1)
 * Used strictly for cross-cutting telemetry: Notifications, Audit Logging, Cache Eviction, Webhooks.
 */
class EventBus {
  private handlers: Map<string, SystemEventHandler[]> = new Map();

  subscribe<T = any>(eventName: string, handler: SystemEventHandler<T>): () => void {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, []);
    }
    this.handlers.get(eventName)!.push(handler);

    return () => {
      const list = this.handlers.get(eventName);
      if (list) {
        this.handlers.set(eventName, list.filter(h => h !== handler));
      }
    };
  }

  async publish<T = any>(event: SystemEvent<T>): Promise<void> {
    const list = this.handlers.get(event.name) || [];
    for (const handler of list) {
      try {
        await handler(event);
      } catch (err) {
        console.error(`[EventBus] Error handling event ${event.name}:`, err);
      }
    }
  }
}

export const eventBus = new EventBus();
