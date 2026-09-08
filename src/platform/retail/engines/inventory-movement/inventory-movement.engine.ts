/**
 * RETAIL OS - INVENTORY MOVEMENT ENGINE (R2)
 * 
 * Implements frozen IInventoryMovementContract.
 * Encapsulates inventory movement domain logic.
 * 
 * @module platform/retail/engines/inventory-movement/inventory-movement.engine
 */

import { randomUUID } from 'crypto';
import type {
  IInventoryMovementContract,
  InventoryMovement,
  RecordMovementRequest,
  ReorderAlert,
} from '../../contracts/inventory-movement.contract';
import type { IInventoryMovementRepository } from './inventory-movement-repository.interface';

/**
 * Inventory Movement Engine (R2)
 * 
 * Implements Retail OS inventory tracking semantics:
 * - Movement recording (RESTOCK/SALE/ADJUSTMENT/RETURN/DAMAGE/TRANSFER)
 * - Stock history
 * - Reorder detection
 * 
 * Invariants enforced:
 * - Movement immutable once recorded
 * - Stock atomicity (movement + product.current_stock updated together)
 * - No negative stock
 */
export class InventoryMovementEngine implements IInventoryMovementContract {
  constructor(private readonly repository: IInventoryMovementRepository) {}

  async recordMovement(request: RecordMovementRequest): Promise<InventoryMovement> {
    // Validate tenant isolation
    if (!request.tenantId) {
      throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    }

    // Get current stock from product
    const currentStock = await this.repository.getProductStock(request.tenantId, request.productId);

    // Calculate new stock
    const newStock = currentStock + request.quantityChange;

    // Invariant: No negative stock
    if (newStock < 0) {
      throw new Error(
        `INSUFFICIENT_STOCK: Cannot reduce stock below zero (current: ${currentStock}, change: ${request.quantityChange})`
      );
    }

    // Build movement entity
    const movement: InventoryMovement = {
      id: randomUUID(),
      tenantId: request.tenantId,
      productId: request.productId,
      movementType: request.movementType,
      quantityChange: request.quantityChange,
      previousStock: currentStock,
      newStock: newStock,
      referenceType: request.referenceType,
      referenceId: request.referenceId,
      reason: request.reason,
      performedBy: request.userId,
      createdAt: new Date().toISOString(),
    };

    // Persist atomically (movement + stock update)
    return await this.repository.createMovementAndUpdateStock(movement, newStock);
  }

  async getMovementHistory(tenantId: string, productId: string): Promise<InventoryMovement[]> {
    // Validate tenant isolation
    if (!tenantId) {
      throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    }

    return await this.repository.findByProductId(tenantId, productId);
  }

  async getCurrentStock(tenantId: string, productId: string): Promise<number> {
    // Validate tenant isolation
    if (!tenantId) {
      throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    }

    return await this.repository.getProductStock(tenantId, productId);
  }

  async detectReorderNeeds(tenantId: string): Promise<ReorderAlert[]> {
    // Validate tenant isolation
    if (!tenantId) {
      throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    }

    return await this.repository.findProductsNeedingReorder(tenantId);
  }
}
