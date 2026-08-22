/**
 * Inventory Repository Interface
 * 
 * Repository pattern for Inventory balance persistence.
 * Handles inventory by item/location/lot/serial combinations.
 */

import type { Inventory } from '../domain/inventory.types';
import type { Result } from '../domain/core/result';

/**
 * Filters for querying inventory
 */
export interface InventoryFilters {
  itemId?: string;
  locationId?: string;
  locationType?: string;
  lotNumber?: string;
  serialNumber?: string;
  status?: 'AVAILABLE' | 'RESERVED' | 'ALLOCATED' | 'QUARANTINE' | 'DAMAGED' | 'EXPIRED' | 'TRANSIT' | 'BLOCKED';
  minQuantityOnHand?: number;
  maxQuantityOnHand?: number;
}

/**
 * Inventory summary (aggregated view)
 */
export interface InventorySummary {
  itemId: string;
  totalOnHand: number;
  totalReserved: number;
  totalAvailable: number;
  locationCount: number;
  locations: Array<{
    locationId: string;
    locationType: string;
    quantityOnHand: number;
    quantityReserved: number;
    quantityAvailable: number;
  }>;
}

/**
 * Inventory repository interface
 */
export interface IInventoryRepository {
  /**
   * Find inventory by ID
   */
  findById(tenantId: string, inventoryId: string): Promise<Result<Inventory | null>>;

  /**
   * Find inventory by unique combination
   * 
   * Inventory is uniquely identified by:
   * - tenantId + itemId + locationId + lotNumber + serialNumber
   */
  findByUnique(
    tenantId: string,
    itemId: string,
    locationId: string,
    lotNumber: string | null,
    serialNumber: string | null
  ): Promise<Result<Inventory | null>>;

  /**
   * List inventory with optional filters
   */
  list(tenantId: string, filters?: InventoryFilters): Promise<Result<Inventory[]>>;

  /**
   * Get inventory summary for an item (aggregated across locations)
   */
  getSummaryByItem(tenantId: string, itemId: string): Promise<Result<InventorySummary | null>>;

  /**
   * Get inventory summary for a location (aggregated across items)
   */
  getSummaryByLocation(tenantId: string, locationId: string): Promise<Result<InventorySummary[]>>;

  /**
   * Save inventory (insert or update)
   * 
   * Domain layer handles balance calculations.
   * Repository only persists the entity.
   */
  save(inventory: Inventory): Promise<Result<Inventory>>;

  /**
   * Save multiple inventory records (batch operation)
   * 
   * Used for bulk movements affecting multiple inventory records.
   * Wrapped in transaction for atomicity.
   */
  saveBatch(inventories: Inventory[]): Promise<Result<Inventory[]>>;

  /**
   * Delete inventory record
   * 
   * Physical deletion allowed for zero-balance records.
   * Records with balance should not be deleted.
   */
  delete(tenantId: string, inventoryId: string): Promise<Result<void>>;

  /**
   * Check if item has any inventory (any location, any lot/serial)
   * 
   * Used before item deactivation.
   */
  hasInventory(tenantId: string, itemId: string): Promise<Result<boolean>>;
}
