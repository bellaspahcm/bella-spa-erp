/**
 * Clinical Order Service
 * 
 * Orchestrates:
 * - Encounter validation (via EncounterReader)
 * - ClinicalOrder aggregate operations
 * - Repository persistence
 * - Event publishing (AFTER persistence succeeds)
 * 
 * Invariant: Event-After-Persistence
 * - Events ONLY published after DB.save() succeeds
 * - If EventBus.publish() fails, DB remains consistent
 * - No fake rollback via event handlers
 */

import type { ClinicalOrder, OrderType, OrderStatus, OrderPriority } from '../domain/clinical-order.entity';
import { ClinicalOrder as ClinicalOrderEntity } from '../domain/clinical-order.entity';
import type { OrderRepository } from '../repositories/order-repository.interface';
import { IdempotencyConflictError } from '../repositories/order-repository.interface';
import type { EncounterReader } from '../contracts/encounter-reader.interface';
import { EncounterNotFoundError } from '../contracts/encounter-reader.interface';
import type { EventBus } from '../contracts/event-bus.interface';
import { OrderEventFactory } from '../events/order-event-factory';

export interface CreateOrderRequest {
  readonly tenantId: string;
  readonly encounterId: string;
  readonly patientId: string;  // Domain field name (maps to patient_party_id in DB)
  readonly orderType: OrderType;
  readonly priority: OrderPriority;
  readonly orderedBy: string;
  readonly orderDetails: Record<string, unknown>;
  readonly requestId?: string;  // For idempotency
}

export interface ApproveOrderRequest {
  readonly tenantId: string;
  readonly orderId: string;
  readonly approvedBy: string;
  readonly expectedVersion?: number;  // For optimistic locking
}

export interface DiscontinueOrderRequest {
  readonly tenantId: string;
  readonly orderId: string;
  readonly discontinuedBy: string;
  readonly discontinueReason: string;
  readonly expectedVersion?: number;  // For optimistic locking
}

export interface OrderServiceResult<T = ClinicalOrder> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
  readonly eventPublished: boolean;
}

export class ClinicalOrderService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly encounterReader: EncounterReader,
    private readonly eventBus: EventBus,
  ) {}
  
  /**
   * Create new clinical order
   * 
   * Flow:
   * 1. Validate encounter exists and allows orders
   * 2. Validate patient belongs to encounter
   * 3. Create ClinicalOrder aggregate
   * 4. Persist to repository
   * 5. Publish OrderCreated event (AFTER persistence)
   * 
   * @param request Order creation request
   * @returns OrderServiceResult with created order
   */
  async createOrder(
    request: CreateOrderRequest
  ): Promise<OrderServiceResult> {
    try {
      // STEP 0: Check for idempotency
      if (request.requestId) {
        const existing = await this.orderRepository.findByRequestId(
          request.tenantId,
          request.requestId
        );
        if (existing) {
          return {
            success: true,
            data: existing,
            eventPublished: false,
          };
        }
      }

      // STEP 1: Validate encounter
      const encounter = await this.encounterReader.getEncounterSnapshot(
        request.tenantId,
        request.encounterId
      );
      
      // STEP 2: Validate patient belongs to encounter
      if (encounter.patientPartyId !== request.patientId) {
        return {
          success: false,
          error: `Patient ${request.patientId} does not belong to encounter ${request.encounterId}`,
          eventPublished: false,
        };
      }
      
      // STEP 3: Validate encounter allows ordering
      const canOrder = await this.encounterReader.canCreateOrders(
        request.tenantId,
        request.encounterId
      );
      
      if (!canOrder) {
        return {
          success: false,
          error: `Encounter ${request.encounterId} status ${encounter.status} does not allow new orders`,
          eventPublished: false,
        };
      }
      
      // STEP 4: Create ClinicalOrder aggregate
      const order = ClinicalOrderEntity.create({
        tenantId: request.tenantId,
        encounterId: request.encounterId,
        patientId: request.patientId,  // Domain uses patientId
        orderType: request.orderType,
        priority: request.priority,
        orderedBy: request.orderedBy,
        orderDetails: request.orderDetails,
      });
      
      // STEP 5: Persist to repository
      const persistedOrder = await this.orderRepository.create(order, request.requestId);
      
      // STEP 6: Publish event (AFTER persistence succeeds)
      const event = OrderEventFactory.createOrderCreatedEvent(persistedOrder, request.requestId);
      const publishResult = await this.eventBus.publish(event);
      
      if (!publishResult.success) {
        // Log error but don't fail the operation
        // DB is already consistent, event will be retried via outbox (Phase D)
        console.error('[ClinicalOrderService] Failed to publish OrderCreated event:', publishResult.error);
      }
      
      return {
        success: true,
        data: persistedOrder,
        eventPublished: publishResult.success,
      };
    } catch (error) {
      if (error instanceof EncounterNotFoundError) {
        return {
          success: false,
          error: `Encounter ${request.encounterId} not found`,
          eventPublished: false,
        };
      }
      
      if (error instanceof IdempotencyConflictError) {
        const existing = await this.orderRepository.findByRequestId(
          request.tenantId,
          request.requestId!
        );
        if (existing) {
          return {
            success: true,
            data: existing,
            eventPublished: false,
          };
        }
        return {
          success: false,
          error: `Idempotency conflict detected but order not found for requestId: ${request.requestId}`,
          eventPublished: false,
        };
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        eventPublished: false,
      };
    }
  }
  
  /**
   * Approve clinical order
   * 
   * Flow:
   * 1. Load order from repository
   * 2. Validate tenant isolation
   * 3. Call order.approve()
   * 4. Persist with optimistic locking
   * 5. Publish OrderApproved event (AFTER persistence)
   * 
   * @param request Order approval request
   * @returns OrderServiceResult with approved order
   */
  async approveOrder(
    request: ApproveOrderRequest
  ): Promise<OrderServiceResult> {
    try {
      // STEP 1: Load order
      const order = await this.orderRepository.findById(request.tenantId, request.orderId);
      
      if (!order) {
        return {
          success: false,
          error: `Order ${request.orderId} not found`,
          eventPublished: false,
        };
      }
      
      // STEP 2: Capture previous state for event
      const previousStatus = order.orderStatus;
      
      // STEP 3: Approve order (domain logic)
      order.approve(request.approvedBy);
      
      // STEP 4: Persist with optimistic locking
      const updatedOrder = await this.orderRepository.update(order, {
        expectedVersion: request.expectedVersion,
      });
      
      // STEP 5: Publish event (AFTER persistence succeeds)
      const event = OrderEventFactory.createOrderApprovedEvent(updatedOrder, previousStatus);
      const publishResult = await this.eventBus.publish(event);
      
      if (!publishResult.success) {
        console.error('[ClinicalOrderService] Failed to publish OrderApproved event:', publishResult.error);
      }
      
      return {
        success: true,
        data: updatedOrder,
        eventPublished: publishResult.success,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        eventPublished: false,
      };
    }
  }
  
  /**
   * Discontinue clinical order
   * 
   * Flow:
   * 1. Load order from repository
   * 2. Validate tenant isolation
   * 3. Call order.discontinue()
   * 4. Persist with optimistic locking
   * 5. Publish OrderDiscontinued event (AFTER persistence)
   * 
   * @param request Order discontinuation request
   * @returns OrderServiceResult with discontinued order
   */
  async discontinueOrder(
    request: DiscontinueOrderRequest
  ): Promise<OrderServiceResult> {
    try {
      // STEP 1: Load order
      const order = await this.orderRepository.findById(request.tenantId, request.orderId);
      
      if (!order) {
        return {
          success: false,
          error: `Order ${request.orderId} not found`,
          eventPublished: false,
        };
      }
      
      // STEP 2: Capture previous state for event
      const previousStatus = order.orderStatus;
      
      // STEP 3: Discontinue order (domain logic)
      order.discontinue(request.discontinuedBy, request.discontinueReason);
      
      // STEP 4: Persist with optimistic locking
      const updatedOrder = await this.orderRepository.update(order, {
        expectedVersion: request.expectedVersion,
      });
      
      // STEP 5: Publish event (AFTER persistence succeeds)
      const event = OrderEventFactory.createOrderDiscontinuedEvent(updatedOrder, previousStatus);
      const publishResult = await this.eventBus.publish(event);
      
      if (!publishResult.success) {
        console.error('[ClinicalOrderService] Failed to publish OrderDiscontinued event:', publishResult.error);
      }
      
      return {
        success: true,
        data: updatedOrder,
        eventPublished: publishResult.success,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        eventPublished: false,
      };
    }
  }
}
