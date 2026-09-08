/**
 * MANUFACTURING OS - WORK ORDER REPOSITORY INTERFACE
 * 
 * Repository contract for Work Order persistence.
 * 
 * @module platform/manufacturing/engines/work-order
 */

import type { WorkOrder, WorkOrderStatus } from '../../contracts/work-order.contract';

export interface IWorkOrderRepository {
  /**
   * Create new work order
   * Throws if order number already exists (DB constraint)
   */
  create(workOrder: WorkOrder): Promise<WorkOrder>;

  /**
   * Update work order status
   */
  updateStatus(
    tenantId: string,
    workOrderId: string,
    status: WorkOrderStatus,
    actualStartAt?: string,
    actualEndAt?: string,
    actualQuantity?: number,
    userId?: string
  ): Promise<WorkOrder>;

  /**
   * Find work order by ID
   */
  findById(tenantId: string, workOrderId: string): Promise<WorkOrder | null>;

  /**
   * Find work order by order number
   */
  findByOrderNumber(tenantId: string, orderNumber: string): Promise<WorkOrder | null>;
}
