/**
 * Order Event Factory
 * 
 * Adapters to create domain events from ClinicalOrder aggregate
 * No duplicate event schema - uses contracts from order-events.ts
 */

import { randomUUID } from 'crypto';
import type { ClinicalOrder } from '../domain/clinical-order.entity';
import type {
  OrderCreatedEvent,
  OrderApprovedEvent,
  OrderDiscontinuedEvent,
} from './order-events';

const EVENT_VERSION = '1.0.0';

export class OrderEventFactory {
  /**
   * Create OrderCreated event from newly created order
   * 
   * MUST be called AFTER repository.create() succeeds
   */
  static createOrderCreatedEvent(
    order: ClinicalOrder,
    requestId?: string,
  ): OrderCreatedEvent {
    return {
      eventType: 'OrderCreated',
      eventId: randomUUID(),
      eventVersion: EVENT_VERSION,
      occurredAt: new Date(),
      tenantId: order.tenantId,
      aggregateId: order.id,
      aggregateType: 'ClinicalOrder',
      aggregateVersion: order.version,
      payload: {
        orderId: order.id,
        encounterId: order.encounterId,
        patientId: order.patientId,  // Domain field
        orderType: order.orderType,
        orderStatus: order.orderStatus,
        priority: order.priority,
        orderedBy: order.orderedBy,
        orderedAt: order.orderedAt,
        orderDetails: order.orderDetails,
        requestId,
      },
    };
  }
  
  /**
   * Create OrderApproved event from approved order
   * 
   * MUST be called AFTER repository.update() succeeds
   * 
   * @param order Order AFTER approval (with incremented version)
   * @param previousStatus Status before approval
   */
  static createOrderApprovedEvent(
    order: ClinicalOrder,
    previousStatus: ClinicalOrder['orderStatus'],
  ): OrderApprovedEvent {
    if (!order.approvedBy || !order.approvedAt) {
      throw new Error('Order must be approved before creating OrderApprovedEvent');
    }
    
    const previousVersion = order.version - 1;  // Current version already incremented
    
    return {
      eventType: 'OrderApproved',
      eventId: randomUUID(),
      eventVersion: EVENT_VERSION,
      occurredAt: new Date(),
      tenantId: order.tenantId,
      aggregateId: order.id,
      aggregateType: 'ClinicalOrder',
      aggregateVersion: order.version,
      payload: {
        orderId: order.id,
        encounterId: order.encounterId,
        patientId: order.patientId,  // Domain field
        approvedBy: order.approvedBy,
        approvedAt: order.approvedAt,
        previousStatus,
        newStatus: order.orderStatus,
        previousVersion,
        newVersion: order.version,
      },
    };
  }
  
  /**
   * Create OrderDiscontinued event from discontinued order
   * 
   * MUST be called AFTER repository.update() succeeds
   * 
   * @param order Order AFTER discontinuation (with incremented version)
   * @param previousStatus Status before discontinuation
   */
  static createOrderDiscontinuedEvent(
    order: ClinicalOrder,
    previousStatus: ClinicalOrder['orderStatus'],
  ): OrderDiscontinuedEvent {
    if (!order.discontinuedBy || !order.discontinuedAt || !order.discontinueReason) {
      throw new Error('Order must be discontinued before creating OrderDiscontinuedEvent');
    }
    
    const previousVersion = order.version - 1;  // Current version already incremented
    
    return {
      eventType: 'OrderDiscontinued',
      eventId: randomUUID(),
      eventVersion: EVENT_VERSION,
      occurredAt: new Date(),
      tenantId: order.tenantId,
      aggregateId: order.id,
      aggregateType: 'ClinicalOrder',
      aggregateVersion: order.version,
      payload: {
        orderId: order.id,
        encounterId: order.encounterId,
        patientId: order.patientId,  // Domain field
        discontinuedBy: order.discontinuedBy,
        discontinuedAt: order.discontinuedAt,
        discontinueReason: order.discontinueReason,
        previousStatus,
        newStatus: order.orderStatus,
        previousVersion,
        newVersion: order.version,
      },
    };
  }
}
