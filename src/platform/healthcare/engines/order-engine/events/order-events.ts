/**
 * Clinical Order Domain Events
 * 
 * Invariant: Events MUST be published AFTER successful DB persistence
 * 
 * Event ordering:
 * 1. Request received
 * 2. Domain logic executed
 * 3. Repository.save() SUCCESS
 * 4. EventBus.publish()
 * 
 * If EventBus.publish() fails:
 * - Persistence already succeeded (DB consistent)
 * - Log error, retry via outbox pattern (Phase D)
 * - DO NOT rollback DB (no fake business logic in event handler)
 */

import type { OrderType, OrderStatus, OrderPriority } from '../domain/clinical-order.entity';

/**
 * Base event structure for all order events
 */
export interface OrderDomainEvent {
  readonly eventType: string;
  readonly eventId: string;
  readonly eventVersion: string;
  readonly occurredAt: Date;
  readonly tenantId: string;
  readonly aggregateId: string;  // orderId
  readonly aggregateType: 'ClinicalOrder';
  readonly aggregateVersion: number;
}

/**
 * OrderCreated: Published after order successfully persisted
 */
export interface OrderCreatedEvent extends OrderDomainEvent {
  readonly eventType: 'OrderCreated';
  readonly payload: {
    readonly orderId: string;
    readonly encounterId: string;
    readonly patientId: string;  // Domain field (maps to patient_party_id in DB)
    readonly orderType: OrderType;
    readonly orderStatus: OrderStatus;
    readonly priority: OrderPriority;
    readonly orderedBy: string;
    readonly orderedAt: Date;
    readonly orderDetails: Record<string, unknown>;
    readonly requestId?: string;  // For idempotency tracking
  };
}

/**
 * OrderApproved: Published after order approval persisted
 */
export interface OrderApprovedEvent extends OrderDomainEvent {
  readonly eventType: 'OrderApproved';
  readonly payload: {
    readonly orderId: string;
    readonly encounterId: string;
    readonly patientId: string;  // Domain field
    readonly approvedBy: string;
    readonly approvedAt: Date;
    readonly previousStatus: OrderStatus;
    readonly newStatus: OrderStatus;
    readonly previousVersion: number;
    readonly newVersion: number;
  };
}

/**
 * OrderDiscontinued: Published after order discontinuation persisted
 */
export interface OrderDiscontinuedEvent extends OrderDomainEvent {
  readonly eventType: 'OrderDiscontinued';
  readonly payload: {
    readonly orderId: string;
    readonly encounterId: string;
    readonly patientId: string;  // Domain field
    readonly discontinuedBy: string;
    readonly discontinuedAt: Date;
    readonly discontinueReason: string;
    readonly previousStatus: OrderStatus;
    readonly newStatus: OrderStatus;
    readonly previousVersion: number;
    readonly newVersion: number;
  };
}

/**
 * Union type for all order events
 */
export type OrderEvent = 
  | OrderCreatedEvent
  | OrderApprovedEvent
  | OrderDiscontinuedEvent;
