/**
 * MANUFACTURING OS - PRODUCTION TRACKING CONTRACT (M2)
 * 
 * Public contract for Production Output Tracking capability.
 * Defines canonical manufacturing production recording operations.
 * 
 * Ownership: Manufacturing OS (Industry Kernel)
 * Consumers: Manufacturing Products (factory-floor, quality-control, etc.)
 * Status: BASELINE (extracted from Manufacturing domain analysis)
 * 
 * @module platform/manufacturing/contracts/production-tracking.contract
 */

/**
 * Production Status
 */
export type ProductionStatus = 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';

/**
 * Production Record Entity (Domain representation)
 * 
 * Tracks actual production output for a work order.
 * One work order can have multiple production records (batch production).
 */
export interface ProductionRecord {
  id: string;
  tenantId: string;
  workOrderId: string;
  batchNumber?: string; // Optional batch identifier
  quantityProduced: number;
  quantityRejected: number;
  status: ProductionStatus;
  producedAt: string; // ISO timestamp
  producedBy?: string; // Worker/operator ID
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Record Production Request
 */
export interface RecordProductionRequest {
  tenantId: string;
  workOrderId: string;
  batchNumber?: string;
  quantityProduced: number;
  quantityRejected?: number; // defaults to 0
  producedBy?: string;
  notes?: string;
  userId?: string; // for audit trail
}

/**
 * Production Summary
 * Aggregated production data for a work order
 */
export interface ProductionSummary {
  workOrderId: string;
  totalProduced: number;
  totalRejected: number;
  totalRecords: number;
  completionPercentage: number; // (totalProduced / plannedQuantity) * 100
  qualityRate: number; // (totalProduced / (totalProduced + totalRejected)) * 100
}

/**
 * Production Tracking Contract (M2)
 * 
 * Defines Manufacturing OS ownership of production output semantics:
 * - Production recording (what was produced, when, by whom)
 * - Quantity tracking (produced vs rejected)
 * - Production history / audit trail
 * - Aggregate production metrics
 * 
 * OUT OF SCOPE (Product-specific):
 * - Detailed quality inspection workflows
 * - Defect categorization / root cause analysis
 * - Labor time tracking / efficiency metrics
 * - Machine/equipment utilization tracking
 */
export interface IProductionTrackingContract {
  /**
   * Record production output
   * 
   * Invariants:
   * - Work order must exist and be IN_PROGRESS
   * - Quantity produced must be non-negative
   * - Quantity rejected must be non-negative
   * - Tenant isolation enforced
   * 
   * @param request - Production recording data
   * @returns Created production record
   * @throws TENANT_ISOLATION_VIOLATION if tenantId missing
   * @throws WORK_ORDER_NOT_FOUND if work order doesn't exist
   * @throws WORK_ORDER_NOT_IN_PROGRESS if work order not started
   * @throws INVALID_QUANTITY if quantities negative
   */
  recordProduction(request: RecordProductionRequest): Promise<ProductionRecord>;

  /**
   * Get production history for work order
   * 
   * Returns all production records ordered by producedAt DESC (most recent first)
   * 
   * @param tenantId - Tenant identifier
   * @param workOrderId - Work order identifier
   * @returns Array of production records (empty if none)
   * @throws TENANT_ISOLATION_VIOLATION if tenantId missing
   */
  getProductionHistory(tenantId: string, workOrderId: string): Promise<ProductionRecord[]>;

  /**
   * Get production summary for work order
   * 
   * Returns aggregated production metrics
   * 
   * @param tenantId - Tenant identifier
   * @param workOrderId - Work order identifier
   * @param plannedQuantity - Planned quantity from work order (for completion %)
   * @returns Production summary
   * @throws TENANT_ISOLATION_VIOLATION if tenantId missing
   * @throws WORK_ORDER_NOT_FOUND if work order doesn't exist
   */
  getProductionSummary(
    tenantId: string, 
    workOrderId: string, 
    plannedQuantity: number
  ): Promise<ProductionSummary>;
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
