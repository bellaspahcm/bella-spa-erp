import { eventBus, SystemEvent } from '../messaging/event-bus/event-bus';

export interface Projector {
  readonly name: string;
  readonly eventNames: string[];
  project(event: SystemEvent): Promise<void> | void;
}

export class ProjectionEngine {
  private static instance: ProjectionEngine;
  private projectors: Map<string, Set<Projector>> = new Map();
  private eventBusUnsubscribers: Map<string, () => void> = new Map();

  private constructor() {}

  public static getInstance(): ProjectionEngine {
    if (!ProjectionEngine.instance) {
      ProjectionEngine.instance = new ProjectionEngine();
    }
    return ProjectionEngine.instance;
  }

  public register(projector: Projector): () => void {
    const unsubscribers: (() => void)[] = [];

    for (const eventName of projector.eventNames) {
      if (!this.projectors.has(eventName)) {
        this.projectors.set(eventName, new Set());

        // Dynamic bridge: subscribe to Platform EventBus if this is the first projector for this event
        const unsub = eventBus.subscribe(eventName, async (event) => {
          await this.dispatch(eventName, event);
        });
        this.eventBusUnsubscribers.set(eventName, unsub);
      }

      this.projectors.get(eventName)!.add(projector);

      // Unsubscriber for this specific projector
      unsubscribers.push(() => {
        const set = this.projectors.get(eventName);
        if (set) {
          set.delete(projector);
          if (set.size === 0) {
            // Clean up event bus subscription if no projectors left
            const busUnsub = this.eventBusUnsubscribers.get(eventName);
            if (busUnsub) {
              busUnsub();
              this.eventBusUnsubscribers.delete(eventName);
            }
            this.projectors.delete(eventName);
          }
        }
      });
    }

    return () => {
      for (const unsub of unsubscribers) {
        unsub();
      }
    };
  }

  private async dispatch(eventName: string, event: SystemEvent): Promise<void> {
    const list = this.projectors.get(eventName);
    if (!list) return;

    for (const projector of list) {
      try {
        await projector.project(event);
      } catch (err: unknown) {
        console.error(
          `[ProjectionEngine Error] Projector "%s" failed to process event "%s":`,
          projector.name,
          eventName,
          err
        );
      }
    }
  }

  // Clear helper for unit tests
  public clear(): void {
    for (const unsub of this.eventBusUnsubscribers.values()) {
      unsub();
    }
    this.eventBusUnsubscribers.clear();
    this.projectors.clear();
  }
}

export const projectionEngine = ProjectionEngine.getInstance();
