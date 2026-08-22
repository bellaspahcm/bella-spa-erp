/**
 * Movement Repository Interface
 * 
 * Repository pattern for Inventory Movement persistence.
 * 
 * NOTE: Contract-only (E7.1.5).
 * Implementation deferred to E7.1.6 test-driven need.
 */

import type { InventoryMovement } from '../domain/movement.types';
import type { Result } from '../domain/core/result';

/**
 * Filters for querying movements
 */
export interface MovementFilters {
  itemId?: string;
  movementType?: string;
  direction?: 'INBOUND' | 'OUTBOUND' | 'NEUTRAL';
  status?: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  fromLocationId?: string;
  toLocationId?: string;
  lotNumber?: string;
  serialNumber?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

/**
 * Movement repository interface (contract only)
 * 
 * Implementation deferred to test-driven need.
 */
export interface IMovementRepository {
  findById(tenantId: string, movementId: string): Promise<Result<InventoryMovement | null>>;
  findByMovementNumber(tenantId: string, movementNumber: string): Promise<Result<InventoryMovement | null>>;
  list(tenantId: string, filters?: MovementFilters): Promise<Result<InventoryMovement[]>>;
  save(movement: InventoryMovement): Promise<Result<InventoryMovement>>;
  saveBatch(movements: InventoryMovement[]): Promise<Result<InventoryMovement[]>>;
}
