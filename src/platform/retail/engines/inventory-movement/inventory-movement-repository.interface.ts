/**
 * RETAIL OS - INVENTORY MOVEMENT REPOSITORY INTERFACE
 * 
 * Repository interface for inventory movement persistence.
 * Separates domain logic from infrastructure.
 * 
 * @module platform/retail/engines/inventory-movement/inventory-movement-repository.interface
 */

import type { InventoryMovement, ReorderAlert } from '../../contracts/inventory-movement.contract';

/**
 * Inventory Movement Repository Interface
 * 
 * Defines persistence operations for inventory movement entities.
 * Implementation handles DB access, RLS, audit trail, stock updates.
 */
export interface IInventoryMovementRepository {
  /**
   * Create inventory movement and update product stock atomically
   * 
   * @param movement - Movement to record
   * @param newStock - New stock level to set on product
   * @returns Created movement
   */
  createMovementAndUpdateStock(movement: InventoryMovement, newStock: number): Promise<InventoryMovement>;

  /**
   * Find movements for a product (ordered by created_at DESC)
   */
  findByProductId(tenantId: string, productId: string): Promise<InventoryMovement[]>;

  /**
   * Get current stock for a product
   */
  getProductStock(tenantId: string, productId: string): Promise<number>;

  /**
   * Find products needing reorder (current_stock <= reorder_point)
   */
  findProductsNeedingReorder(tenantId: string): Promise<ReorderAlert[]>;
}
