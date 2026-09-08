/**
 * RETAIL OS - INVENTORY MOVEMENT CONTRACT (R2)
 * 
 * Frozen public contract for Inventory Movement capability.
 * Defines canonical retail inventory tracking with audit trail.
 * 
 * Ownership: Retail OS (Industry Kernel)
 * Consumers: Retail Products (bella-retail-store, future retail products)
 * Status: FROZEN (extracted from Product #1 evidence)
 * 
 * @module platform/retail/contracts/inventory-movement.contract
 */

/**
 * Inventory Movement Types
 * 
 * SALE: Stock decrease due to completed sale
 * RESTOCK: Stock increase due to receiving inventory
 * ADJUSTMENT: Manual stock correction
 * RETURN: Stock increase due to customer return
 * DAMAGE: Stock decrease due to damaged goods
 * TRANSFER: Stock transfer between locations (not implemented yet)
 */
export type InventoryMovementType =
  | 'SALE'
  | 'RESTOCK'
  | 'ADJUSTMENT'
  | 'RETURN'
  | 'DAMAGE'
  | 'TRANSFER';

/**
 * Reference Type (what triggered the movement)
 */
export type MovementReferenceType = 'SALE' | 'MANUAL' | 'SYSTEM';

/**
 * Inventory Movement Entity (Domain representation)
 */
export interface InventoryMovement {
  id: string;
  tenantId: string;
  productId: string;
  movementType: InventoryMovementType;
  quantityChange: number; // Positive = increase, Negative = decrease
  previousStock: number;
  newStock: number;
  referenceType?: MovementReferenceType;
  referenceId?: string; // e.g., Sale ID
  reason?: string;
  performedBy?: string; // User ID
  createdAt: string;
}

/**
 * Record Inventory Movement Request
 */
export interface RecordMovementRequest {
  tenantId: string;
  productId: string;
  movementType: InventoryMovementType;
  quantityChange: number; // Positive or negative
  referenceType?: MovementReferenceType;
  referenceId?: string;
  reason?: string;
  userId?: string;
}

/**
 * Reorder Alert
 */
export interface ReorderAlert {
  product: {
    id: string;
    sku: string;
    name: string;
  };
  currentStock: number;
  reorderPoint: number;
  deficit: number; // How much below reorder point
}

/**
 * Inventory Movement Contract (R2)
 * 
 * Defines Retail OS ownership of inventory movement semantics:
 * - Stock movement recording with audit trail
 * - Previous → New stock transitions (immutable once recorded)
 * - Reorder detection based on reorder points
 * - Movement history queries
 * 
 * OUT OF SCOPE (Product-specific):
 * - Multi-location inventory (store vs warehouse)
 * - Reserved/allocated stock (e-commerce specific)
 * - Backorder logic (B2B specific)
 * - Reorder automation / purchase order generation
 * - Stock forecasting / predictive reordering
 */
export interface IInventoryMovementContract {
  /**
   * Record inventory movement with audit trail
   * 
   * Invariants:
   * - Product must exist and track inventory
   * - Movement creates immutable record (previous → new stock)
   * - Product current_stock updated atomically
   * - Negative stock not allowed (throws error)
   * 
   * @param request - Movement recording data
   * @returns Created inventory movement record
   * @throws TENANT_ISOLATION_VIOLATION if tenantId missing
   * @throws PRODUCT_NOT_FOUND if product doesn't exist
   * @throws NEGATIVE_STOCK_ERROR if movement would cause negative stock
   * @throws INVENTORY_MOVEMENT_CREATE_FAILED if recording fails
   */
  recordMovement(request: RecordMovementRequest): Promise<InventoryMovement>;

  /**
   * Get movement history for a product
   * 
   * Returns movements ordered by created_at DESC (most recent first)
   * 
   * @param tenantId - Tenant identifier
   * @param productId - Product identifier
   * @returns Array of movements (empty if none)
   * @throws TENANT_ISOLATION_VIOLATION if tenantId missing
   */
  getMovementHistory(tenantId: string, productId: string): Promise<InventoryMovement[]>;

  /**
   * Get current stock for a product
   * 
   * Returns real-time stock level from product record
   * 
   * @param tenantId - Tenant identifier
   * @param productId - Product identifier
   * @returns Current stock quantity
   * @throws TENANT_ISOLATION_VIOLATION if tenantId missing
   * @throws PRODUCT_NOT_FOUND if product doesn't exist
   */
  getCurrentStock(tenantId: string, productId: string): Promise<number>;

  /**
   * Detect products needing reorder
   * 
   * Returns products where:
   * - track_inventory = true
   * - reorder_point is set
   * - current_stock <= reorder_point
   * 
   * @param tenantId - Tenant identifier
   * @returns Array of reorder alerts (empty if none)
   * @throws TENANT_ISOLATION_VIOLATION if tenantId missing
   */
  detectReorderNeeds(tenantId: string): Promise<ReorderAlert[]>;
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
