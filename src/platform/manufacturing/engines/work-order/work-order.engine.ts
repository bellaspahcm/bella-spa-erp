/**
 * MANUFACTURING OS - WORK ORDER ENGINE (M1)
 * 
 * Implements IWorkOrderContract.
 * Encapsulates work order lifecycle domain logic.
 * 
 * @module platform/manufacturing/engines/work-order/work-order.engine
 */

import { randomUUID } from 'crypto';
import type {
  IWorkOrderContract,
  WorkOrder,
  CreateWorkOrderRequest,
  UpdateWorkOrderStatusRequest,
  StartWorkOrderRequest,
  CompleteWorkOrderRequest,
  WorkOrderStatus,
} from '../../contracts/work-order.contract';
import type { IWorkOrderRepository } from './work-order-repository.interface';

/**
 * Work Order Engine (M1)
 * 
 * Implements Manufacturing OS work order semantics:
 * - Work order CRUD with order number identity
 * - Status lifecycle (DRAFT → SCHEDULED → IN_PROGRESS → COMPLETED)
 * - Status transition rules (COMPLETED/CANCELLED final)
 * 
 * Invariants enforced:
 * - Order number unique per tenant (DB constraint)
 * - Quantity positivity
 * - Status transition validity
 * - Finality of COMPLETED/CANCELLED states
 */
export class WorkOrderEngine implements IWorkOrderContract {
  constructor(private readonly repository: IWorkOrderRepository) {}

  async createWorkOrder(request: CreateWorkOrderRequest): Promise<WorkOrder> {
    // Validate tenant isolation
    if (!request.tenantId) {
      throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    }

    // Validate quantity positivity
    if (request.quantity <= 0) {
      throw new Error('INVALID_QUANTITY: quantity must be positive');
    }

    // Build work order entity
    const workOrder: WorkOrder = {
      id: randomUUID(),
      tenantId: request.tenantId,
      orderNumber: request.orderNumber,
      productId: request.productId,
      quantity: request.quantity,
      priority: request.priority || 'NORMAL',
      status: 'DRAFT',
      scheduledStartAt: request.scheduledStartAt,
      scheduledEndAt: request.scheduledEndAt,
      notes: request.notes,
      createdBy: request.userId,
      updatedBy: request.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Persist (repository handles order number uniqueness constraint)
    return await this.repository.create(workOrder);
  }

  async updateWorkOrderStatus(request: UpdateWorkOrderStatusRequest): Promise<WorkOrder> {
    // Validate tenant isolation
    if (!request.tenantId) {
      throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    }

    // Check current status to enforce transition rules
    const currentWorkOrder = await this.repository.findById(request.tenantId, request.workOrderId);

    if (!currentWorkOrder) {
      throw new Error('WORK_ORDER_NOT_FOUND: Work order does not exist');
    }

    // Invariant: COMPLETED is final
    if (currentWorkOrder.status === 'COMPLETED') {
      throw new Error('WORK_ORDER_FINALITY_VIOLATION: Cannot modify completed work order');
    }

    // Invariant: CANCELLED is final
    if (currentWorkOrder.status === 'CANCELLED') {
      throw new Error('WORK_ORDER_FINALITY_VIOLATION: Cannot modify cancelled work order');
    }

    // Validate status transition
    this.validateStatusTransition(currentWorkOrder.status, request.status);

    // Update status via repository
    return await this.repository.updateStatus(
      request.tenantId,
      request.workOrderId,
      request.status,
      undefined, // actualStartAt (set by startWorkOrder)
      undefined, // actualEndAt (set by completeWorkOrder)
      undefined, // actualQuantity (set by completeWorkOrder)
      request.userId
    );
  }

  async startWorkOrder(request: StartWorkOrderRequest): Promise<WorkOrder> {
    // Validate tenant isolation
    if (!request.tenantId) {
      throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    }

    // Check current status
    const currentWorkOrder = await this.repository.findById(request.tenantId, request.workOrderId);

    if (!currentWorkOrder) {
      throw new Error('WORK_ORDER_NOT_FOUND: Work order does not exist');
    }

    // Must be SCHEDULED or PAUSED to start
    if (currentWorkOrder.status !== 'SCHEDULED' && currentWorkOrder.status !== 'PAUSED') {
      throw new Error(
        'WORK_ORDER_NOT_STARTED_STATUS: Work order must be SCHEDULED or PAUSED to start'
      );
    }

    // Update status to IN_PROGRESS with actualStartAt timestamp
    return await this.repository.updateStatus(
      request.tenantId,
      request.workOrderId,
      'IN_PROGRESS',
      new Date().toISOString(), // actualStartAt
      undefined,
      undefined,
      request.userId
    );
  }

  async completeWorkOrder(request: CompleteWorkOrderRequest): Promise<WorkOrder> {
    // Validate tenant isolation
    if (!request.tenantId) {
      throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    }

    // Validate actual quantity
    if (request.actualQuantity <= 0) {
      throw new Error('INVALID_QUANTITY: actualQuantity must be positive');
    }

    // Check current status
    const currentWorkOrder = await this.repository.findById(request.tenantId, request.workOrderId);

    if (!currentWorkOrder) {
      throw new Error('WORK_ORDER_NOT_FOUND: Work order does not exist');
    }

    // Must be IN_PROGRESS to complete
    if (currentWorkOrder.status !== 'IN_PROGRESS') {
      throw new Error('WORK_ORDER_NOT_IN_PROGRESS: Work order must be in progress to complete');
    }

    // Update status to COMPLETED with actualEndAt timestamp
    return await this.repository.updateStatus(
      request.tenantId,
      request.workOrderId,
      'COMPLETED',
      undefined,
      new Date().toISOString(), // actualEndAt
      request.actualQuantity,
      request.userId
    );
  }

  async getWorkOrderById(tenantId: string, workOrderId: string): Promise<WorkOrder | null> {
    // Validate tenant isolation
    if (!tenantId) {
      throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    }

    return await this.repository.findById(tenantId, workOrderId);
  }

  async getWorkOrderByNumber(tenantId: string, orderNumber: string): Promise<WorkOrder | null> {
    // Validate tenant isolation
    if (!tenantId) {
      throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    }

    return await this.repository.findByOrderNumber(tenantId, orderNumber);
  }

  /**
   * Validate status transition logic
   * Throws if transition is invalid
   */
  private validateStatusTransition(from: WorkOrderStatus, to: WorkOrderStatus): void {
    // Valid transitions:
    // DRAFT → SCHEDULED, CANCELLED
    // SCHEDULED → IN_PROGRESS, CANCELLED
    // IN_PROGRESS → PAUSED, COMPLETED, CANCELLED
    // PAUSED → IN_PROGRESS, CANCELLED
    // COMPLETED → (none, final)
    // CANCELLED → (none, final)

    const validTransitions: Record<WorkOrderStatus, WorkOrderStatus[]> = {
      DRAFT: ['SCHEDULED', 'CANCELLED'],
      SCHEDULED: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['PAUSED', 'COMPLETED', 'CANCELLED'],
      PAUSED: ['IN_PROGRESS', 'CANCELLED'],
      COMPLETED: [],
      CANCELLED: [],
    };

    if (!validTransitions[from].includes(to)) {
      throw new Error(
        `INVALID_STATUS_TRANSITION: Cannot transition from ${from} to ${to}`
      );
    }
  }
}
