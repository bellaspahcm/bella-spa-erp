import type { SupabaseClient } from '@supabase/supabase-js';

import { eventBus } from '@/platform/host/event-bus';
import type { DomainEvent } from '@/platform/host/event-bus/types';
import type { Database } from '@/types/database.types';
import type { EventBus, EventPublishResult } from '../engines/order-engine/contracts/event-bus.interface';
import type { OrderEvent, OrderApprovedEvent } from '../engines/order-engine/events/order-events';
import type { OrderStatus } from '../contracts/order-engine.contract';
import { OrderApprovedSubscriber } from '../engines/pharmacy-engine/events/order-approved-subscriber';
import { SupabaseClinicalOrderReader } from '../engines/pharmacy-engine/repositories/supabase-clinical-order-reader';
import { SupabasePharmacyRepository } from '../engines/pharmacy-engine/repositories/supabase-pharmacy.repository';

type OrderApprovedHostPayload = {
  orderId: string;
  encounterId: string;
  patientId: string;
  orderType: string;
  approvedBy: string;
  previousStatus?: OrderStatus;
  newStatus?: OrderStatus;
};

type OrderEventHandler = (event: OrderEvent) => Promise<void>;

class AwaitableOrderEventBus implements EventBus {
  private readonly subscribers = new Map<string, OrderEventHandler[]>();

  async publish(event: OrderEvent): Promise<EventPublishResult> {
    const handlers = this.subscribers.get(event.eventType) ?? [];
    await Promise.all(handlers.map((handler) => handler(event)));

    return {
      success: true,
      eventId: event.eventId,
    };
  }

  async publishBatch(events: OrderEvent[]): Promise<EventPublishResult[]> {
    return Promise.all(events.map((event) => this.publish(event)));
  }

  subscribe(eventType: string, handler: OrderEventHandler): void {
    const handlers = this.subscribers.get(eventType) ?? [];
    handlers.push(handler);
    this.subscribers.set(eventType, handlers);
  }
}

function toOrderApprovedEvent(event: DomainEvent<OrderApprovedHostPayload>): OrderApprovedEvent {
  return {
    eventType: 'OrderApproved',
    eventId: event.eventId,
    eventVersion: event.eventVersion,
    occurredAt: new Date(event.occurredAt),
    tenantId: event.tenantId,
    aggregateId: event.aggregateId,
    aggregateType: 'ClinicalOrder',
    aggregateVersion: 1,
    payload: {
      orderId: event.payload.orderId,
      encounterId: event.payload.encounterId,
      patientId: event.payload.patientId,
      approvedBy: event.payload.approvedBy,
      approvedAt: new Date(event.occurredAt),
      previousStatus: event.payload.previousStatus ?? 'VALIDATED',
      newStatus: event.payload.newStatus ?? 'APPROVED',
      previousVersion: 0,
      newVersion: 1,
    },
  };
}

export function wireOrderApprovedToPharmacy(
  supabase: SupabaseClient<Database>
): () => void {
  const orderEventBus = new AwaitableOrderEventBus();
  const pharmacyRepository = new SupabasePharmacyRepository(supabase);
  const clinicalOrderReader = new SupabaseClinicalOrderReader(supabase);

  new OrderApprovedSubscriber(orderEventBus, pharmacyRepository, clinicalOrderReader);

  return eventBus.subscribe<OrderApprovedHostPayload>(
    'hos.order.approved.v1',
    async (event) => {
      if (event.payload.orderType !== 'MEDICATION') {
        return;
      }

      await orderEventBus.publish(toOrderApprovedEvent(event));
    }
  );
}
