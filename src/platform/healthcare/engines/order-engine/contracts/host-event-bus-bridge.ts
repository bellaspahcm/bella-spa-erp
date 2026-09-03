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
          return {
            success: false,
            error: 'Unsupported order event type',
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

  subscribe(eventType: string, handler: (event: OrderEvent) => Promise<void>): void {
    this.eventBusService.subscribe(eventType as never, handler as never);
  }
}



