/**
 * RETAIL OS - BATCH/LOT TRACKING CONTRACT (R4)
 * 
 * Extension contract for batch/lot management with expiry tracking
 * Enables Fresh Food, Pharmacy, and perishable product inventory.
 * 
 * Ownership: Retail OS (Industry Kernel)
 * Consumers: bella-fresh-food, future pharmacy/perishable products
 * Status: NEW (2026-09-06, evidence-based extension from customer demand)
 * 
 * @module platform/retail/contracts/batch-lot-tracking.contract
 */

/**
 * Batch Status Lifecycle
 * ACTIVE → EXPIRED (automatic when expiry_date passed)
 * ACTIVE → RECALLED (manual intervention)
 */
export type BatchStatus = 'ACTIVE' | 'EXPIRED' | 'RECALLED';

/**
 * Product Batch Entity
 * 
 * Represents a specific batch/lot of a product with expiry tracking
 * Example: Milk Batch#20240906 expires 2024-09-13, stock 50 units
 */
export interface ProductBatch {
  id: string;
  tenantId: string;
  productId: string; // Parent product
  batchNumber: string; // Unique batch identifier
  lotNumber?: string; // Optional secondary identifier
  manufacturedDate?: string; // ISO date
  expiryDate: string; // ISO date (required)
  currentStock: number;
  status: BatchStatus;
  receivedAt: string; // When batch was received into inventory
  createdAt: string;
  updatedAt: string;
}

/**
 * Create Batch Request
 */
export interface CreateBatchRequest {
  tenantId: string;
  productId: string;
  batchNumber: string;
  lotNumber?: string;
  manufacturedDate?: string; // ISO date
  expiryDate: string; // ISO date (required)
  initialStock?: number; // defaults to 0
}

/**
 * Update Batch Stock Request
 */
export interface UpdateBatchStockRequest {
  tenantId: string;
  batchId: string;
  newStock: number;
}

/**
 * Expiry Alert
 */
export interface ExpiryAlert {
  batch: ProductBatch;
  product: {
    id: string;
    sku: string;
    name: string;
  };
  daysUntilExpiry: number;
  currentStock: number;
}

/**
 * Batch/Lot Tracking Contract (R4)
 * 
 * Defines batch/lot management with expiry tracking and FEFO logic
 * 
 * Scope:
 * - Batch creation with expiry dates
 * - Stock tracking per batch
 * - FEFO (First Expire, First Out) queries
 * - Expiry detection and alerts
 * 
 * OUT OF SCOPE:
 * - Batch pricing differences
 * - Batch quality grades
 * - Multi-location batch tracking
 * - Batch recall workflow (status only)
 */
export interface IBatchLotTrackingContract {
  /**
   * Create a product batch
   * 
   * Invariants:
   * - Parent product must exist
   * - batch_number must be unique per product per tenant
   * - expiry_date must be in the future
   * 
   * @param request - Batch creation data
   * @returns Created batch
   * @throws TENANT_ISOLATION_VIOLATION if tenantId missing
   * @throws PRODUCT_NOT_FOUND if parent product doesn't exist
   * @throws BATCH_CREATE_FAILED if creation fails (e.g., duplicate batch_number)
   * @throws INVALID_EXPIRY_DATE if expiry_date in the past
   */
  createBatch(request: CreateBatchRequest): Promise<ProductBatch>;

  /**
   * Get all batches for a product
   * 
   * @param tenantId - Tenant identifier
   * @param productId - Parent product identifier
   * @param includeExpired - Include EXPIRED batches (default: false)
   * @returns Array of batches (empty if none)
   * @throws TENANT_ISOLATION_VIOLATION if tenantId missing
   */
  getBatchesByProduct(
    tenantId: string,
    productId: string,
    includeExpired?: boolean
  ): Promise<ProductBatch[]>;

  /**
   * Get next batch to use (FEFO - First Expire, First Out)
   * 
   * Returns batch with:
   * - status = 'ACTIVE'
   * - current_stock > 0
   * - expiry_date soonest (not yet expired)
   * 
   * @param tenantId - Tenant identifier
   * @param productId - Parent product identifier
   * @returns Batch expiring soonest with stock, null if none
   * @throws TENANT_ISOLATION_VIOLATION if tenantId missing
   */
  getNextBatchFEFO(tenantId: string, productId: string): Promise<ProductBatch | null>;

  /**
   * Get batch by ID
   * 
   * @param tenantId - Tenant identifier
   * @param batchId - Batch identifier
   * @returns Batch if found, null otherwise
   * @throws TENANT_ISOLATION_VIOLATION if tenantId missing
   */
  getBatchById(tenantId: string, batchId: string): Promise<ProductBatch | null>;

  /**
   * Update batch stock
   * 
   * Invariants:
   * - Batch must exist
   * - newStock must be non-negative
   * 
   * @param request - Stock update data
   * @returns Updated batch
   * @throws TENANT_ISOLATION_VIOLATION if tenantId missing
   * @throws BATCH_NOT_FOUND if batch doesn't exist
   * @throws NEGATIVE_STOCK_ERROR if newStock < 0
   */
  updateBatchStock(request: UpdateBatchStockRequest): Promise<ProductBatch>;

  /**
   * Detect batches expiring soon
   * 
   * Returns batches expiring within daysThreshold
   * 
   * @param tenantId - Tenant identifier
   * @param daysThreshold - Days until expiry (default: 7)
   * @returns Array of expiry alerts
   * @throws TENANT_ISOLATION_VIOLATION if tenantId missing
   */
  detectExpiringSoon(tenantId: string, daysThreshold?: number): Promise<ExpiryAlert[]>;

  /**
   * Mark batch as recalled
   * 
   * Sets status to 'RECALLED', preventing further use
   * 
   * @param tenantId - Tenant identifier
   * @param batchId - Batch identifier
   * @param reason - Recall reason
   * @returns Updated batch
   * @throws TENANT_ISOLATION_VIOLATION if tenantId missing
   * @throws BATCH_NOT_FOUND if batch doesn't exist
   */
  recallBatch(tenantId: string, batchId: string, reason: string): Promise<ProductBatch>;

  /**
   * Get total stock across all active batches of a product
   * 
   * Useful for parent product aggregate stock display
   * 
   * @param tenantId - Tenant identifier
   * @param productId - Parent product identifier
   * @returns Total stock (sum of all active batch stocks)
   * @throws TENANT_ISOLATION_VIOLATION if tenantId missing
   */
  getTotalBatchStock(tenantId: string, productId: string): Promise<number>;
}

/**
 * Contract Result Wrapper
 */
export interface ContractResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// ============================================================================
// ENGINE/REPOSITORY COMMAND & EVENT TYPES
// (Used by internal implementation, mapped from public contract interfaces)
// ============================================================================

/**
 * Batch/Lot Entity (internal representation)
 * Maps to ProductBatch in public contract
 */
export interface BatchLot {
  id: string;
  tenantId: string;
  productId: string;
  batchNumber: string;
  lotNumber?: string | null;
  manufacturedDate?: string | null;
  expiryDate: string;
  initialStock: number;
  currentStock: number;
  unit?: string;
  supplierId?: string | null;
  notes?: string | null;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create Batch Command (internal)
 */
export interface CreateBatchLotCommand {
  tenantId: string;
  productId: string;
  batchNumber: string;
  lotNumber?: string;
  manufacturedDate?: string;
  expiryDate: string;
  initialStock: number;
  unit?: string;
  supplierId?: string;
  notes?: string;
  metadata?: Record<string, any>;
}

/**
 * Batch Created Event
 */
export interface BatchLotCreatedEvent {
  eventType: 'BATCH_LOT_CREATED';
  tenantId: string;
  batchId: string;
  productId: string;
  batchNumber: string;
  expiryDate: string;
  initialStock: number;
  timestamp: string;
}

/**
 * Update Batch Stock Command
 */
export interface UpdateBatchStockCommand {
  tenantId: string;
  batchId: string;
  newStock: number;
}

/**
 * Batch Stock Updated Event
 */
export interface BatchStockUpdatedEvent {
  eventType: 'BATCH_STOCK_UPDATED';
  tenantId: string;
  batchId: string;
  previousStock: number;
  newStock: number;
  timestamp: string;
}

/**
 * Reduce Batch Stock Command
 * Used for sales/consumption scenarios with expiry validation
 */
export interface ReduceBatchStockCommand {
  tenantId: string;
  batchId: string;
  quantity: number;
}

/**
 * Get Batch Query
 */
export interface GetBatchQuery {
  tenantId: string;
  batchId: string;
}

/**
 * Get Expiring Batches Query
 */
export interface GetExpiringBatchesQuery {
  tenantId: string;
  thresholdDate: string; // ISO date
}
