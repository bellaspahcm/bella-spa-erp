/**
 * MANUFACTURING OS - WORK ORDER CONTRACT (M1)
 * 
 * Public contract for Work Order Management capability.
 * Defines canonical manufacturing work order lifecycle operations.
 * 
 * Ownership: Manufacturing OS (Industry Kernel)
 * Consumers: Manufacturing Products (factory-floor, production-scheduler, etc.)
 * Status: BASELINE (extracted from Manufacturing domain analysis)
 * 
 * @module platform/manufacturing/contracts/work-order.contract
 */

/**
 * Work Order Status Lifecycle
 * DRAFT → SCHEDULED → IN_PROGRESS → COMPLETED
 * DRAFT → CANCELLED
 * SCHEDULED → CANCELLED
 * IN_PROGRESS → PAUSED → IN_PROGRESS (resumable)
 * IN_PROGRESS → CANCELLED (aborted)
 */
export type WorkOrderStatus = 
  | 'DRAFT' 
  | 'SCHEDULED' 
  | 'IN_PROGRESS' 
  | 'PAUSED' 
  | 'COMPLETED' 
  | 'CANCELLED';

/**
 * Work Order Priority
 */
export type WorkOrderPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

/**
 * Work Order Entity (Domain representation)
 */
export interface WorkOrder {
  id: string;
  tenantId: string;
  orderNumber: string; // Human-readable identifier (e.g., "WO-2024-001")
  productId: string; // What to produce
  quantity: number; // How many units
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  scheduledStartAt?: string; // ISO timestamp
  scheduledEndAt?: string; // ISO timestamp
  actualStartAt?: string;
  actualEndAt?: string;
  notes?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create Work Order Request
 */
export interface CreateWorkOrderRequest {
  tenantId: string;
  orderNumber: string;
  productId: string;
  quantity: number;
  priority?: WorkOrderPriority; // defaults to 'NORMAL'
  scheduledStartAt?: string;
  scheduledEndAt?: string;
  notes?: string;
  userId?: string; // for audit trail
}

/**
 * Update Work Order Status Request
 */
export interface UpdateWorkOrderStatusRequest {
  tenantId: string;
  workOrderId: string;
  status: WorkOrderStatus;
  userId?: string;
}

/**
 * Start Work Order Request
 */
export interface StartWorkOrderRequest {
  tenantId: string;
  workOrderId: string;
  userId?: string;
}

/**
 * Complete Work Order Request
 */
export interface CompleteWorkOrderRequest {
  tenantId: string;
  workOrderId: string;
  actualQuantity: number; // May differ from planned
  userId?: string;
}

/**
 * Work Order Contract (M1)
 * 
 * Defines Manufacturing OS ownership of work order semantics:
 * - Work order identity (order number)
 * - Work order lifecycle (DRAFT → SCHEDULED → IN_PROGRESS → COMPLETED)
 * - Status transitions with business rules
 * - Production scheduling attributes
 * 
 * OUT OF SCOPE (Product-specific):
 * - Production routing / BOM (Bill of Materials)
 * - Resource allocation / capacity planning
 * - Quality control / inspection workflows
 * - Cost accounting / labor tracking
 */
export interface IWorkOrderContract {
  /**
   * Create a new work order
   * 
   * Invariants:
   * - Order number must be unique within tenant
   * - Quantity must be positive
   * - Product must exist
   * - Tenant isolation enforced
   * 
   * @param request - Work order creation data
   * @returns Created work order
   * @throws TENANT_ISOLATION_VIOLATION if tenantId missing
   * @throws DUPLICATE_ORDER_NUMBER if order number already exists
   * @throws INVALID_QUANTITY if quantity <= 0
   */
  createWorkOrder(request: CreateWorkOrderRequest): Promise<WorkOrder>;

  /**
   * Update work order status
   * 
   * Invariants:
   * - COMPLETED status is final (no transitions from COMPLETED)
   * - CANCELLED status is final (no transitions from CANCELLED)
   * - Valid transitions only (e.g., cannot go DRAFT → COMPLETED)
   * 
   * @param request - Status update data
   * @returns Updated work order
   * @throws TENANT_ISOLATION_VIOLATION if tenantId missing
   * @throws WORK_ORDER_NOT_FOUND if work order doesn't exist
   * @throws INVALID_STATUS_TRANSITION if transition not allowed
   * @throws WORK_ORDER_FINALITY_VIOLATION if status is final
   */
  updateWorkOrderStatus(request: UpdateWorkOrderStatusRequest): Promise<WorkOrder>;

  /**
   * Start work order execution
   * 
   * Convenience method for status transition to IN_PROGRESS.
   * Records actualStartAt timestamp.
   * 
   * Invariants:
   * - Work order must be in SCHEDULED or PAUSED status
   * - Sets actualStartAt to current timestamp
   * 
   * @param request - Start work order data
   * @returns Updated work order
   * @throws WORK_ORDER_NOT_STARTED_STATUS if not in correct status
   */
  startWorkOrder(request: StartWorkOrderRequest): Promise<WorkOrder>;

  /**
   * Complete work order execution
   * 
   * Convenience method for status transition to COMPLETED.
   * Records actualEndAt timestamp and actual quantity produced.
   * 
   * Invariants:
   * - Work order must be in IN_PROGRESS status
   * - Actual quantity must be positive
   * - Sets actualEndAt to current timestamp
   * - COMPLETED status is final (no further updates)
   * 
   * @param request - Complete work order data
   * @returns Updated work order
   * @throws WORK_ORDER_NOT_IN_PROGRESS if not currently executing
   * @throws INVALID_QUANTITY if actualQuantity <= 0
   */
  completeWorkOrder(request: CompleteWorkOrderRequest): Promise<WorkOrder>;

  /**
   * Get work order by ID
   * 
   * @param tenantId - Tenant identifier
   * @param workOrderId - Work order identifier
   * @returns Work order or null if not found
   * @throws TENANT_ISOLATION_VIOLATION if tenantId missing
   */
  getWorkOrderById(tenantId: string, workOrderId: string): Promise<WorkOrder | null>;

  /**
   * Get work order by order number
   * 
   * @param tenantId - Tenant identifier
   * @param orderNumber - Human-readable order number
   * @returns Work order or null if not found
   * @throws TENANT_ISOLATION_VIOLATION if tenantId missing
   */
  getWorkOrderByNumber(tenantId: string, orderNumber: string): Promise<WorkOrder | null>;
}

/**
 * Contract Result Wrapper
 * Standardizes success/error responses
 */
export interface ContractResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
