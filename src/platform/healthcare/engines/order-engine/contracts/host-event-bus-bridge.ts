import type { EventBusService } from '@/platform/host/event-bus/event-bus.service';
import type { EventType } from '@/platform/host/event-bus/types';
import type { EventBus, EventPublishResult } from './event-bus.interface';
import type { OrderEvent } from '../events/order-events';

export class HostEventBusBridge implements EventBus {
  constructor(private readonly eventBusService: EventBusService) {}

  async publish(event: OrderEvent): Promise<EventPublishResult> {
    try {
      let hostEventType: EventType;
      switch (event.eventType) {
        case 'OrderCreated':
          hostEventType = 'hos.order.created.v1';
          break;
        case 'OrderApproved':
          hostEventType = 'hos.order.approved.v1';
          break;
        case 'OrderDiscontinued':
          hostEventType = 'hos.order.discontinued.v1';
          break;
        default:
          // Fallback or throw if unrecognized
          const exhaustiveCheck: never = event;
          return {
            success: false,
            error: `Unsupported event type: ${(exhaustiveCheck as OrderEvent).eventType}`,
          };
      }

      await this.eventBusService.publish({
        eventType: hostEventType,
        eventVersion: event.eventVersion,
        tenantId: event.tenantId,
        aggregateId: event.aggregateId,
        aggregateType: event.aggregateType,
        payload: event.payload,
      });

      return {
        success: true,
        eventId: event.eventId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async publishBatch(events: OrderEvent[]): Promise<EventPublishResult[]> {
    return Promise.all(events.map(event => this.publish(event)));
  }

  subscribe(_eventType: string, _handler: (event: OrderEvent) => Promise<void>): void {
    // Host EventBus subscription is managed separately
    // This bridge only handles publish direction
    throw new Error('Subscribe not supported on HostEventBusBridge - use Host EventBus directly');
  }
}
