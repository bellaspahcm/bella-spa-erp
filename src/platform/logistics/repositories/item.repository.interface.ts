/**
 * Item Repository Interface
 * 
 * Repository pattern for Item/SKU persistence.
 * Defines contract for Item data access operations.
 * 
 * Implementation uses dependency inversion:
 * - Domain depends on interface (this file)
 * - Infrastructure implements interface (item.repository.ts)
 */

import type { Item } from '../domain/item.types';
import type { Result } from '../domain/core/result';

/**
 * Filters for querying items
 */
export interface ItemFilters {
  status?: 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';
  type?: 'GOODS' | 'SERVICE' | 'ASSET' | 'VIRTUAL';
  category?: string;
  lotTracked?: boolean;
  serialTracked?: boolean;
  skuCodePattern?: string; // SQL LIKE pattern
}

/**
 * Item repository interface
 * 
 * Pure data access operations (no business logic).
 * Business logic belongs in domain layer.
 */
export interface IItemRepository {
  /**
   * Find item by ID
   * 
   * @param tenantId - Tenant isolation
   * @param itemId - Item UUID
   * @returns Item or null if not found
   */
  findById(tenantId: string, itemId: string): Promise<Result<Item | null>>;

  /**
   * Find item by SKU code (business key)
   * 
   * @param tenantId - Tenant isolation
   * @param skuCode - SKU code (unique per tenant)
   * @returns Item or null if not found
   */
  findBySkuCode(tenantId: string, skuCode: string): Promise<Result<Item | null>>;

  /**
   * List items with optional filters
   * 
   * @param tenantId - Tenant isolation
   * @param filters - Optional filter criteria
   * @returns Array of items (empty if none found)
   */
  list(tenantId: string, filters?: ItemFilters): Promise<Result<Item[]>>;

  /**
   * Save item (insert or update)
   * 
   * Domain layer handles create/update logic.
   * Repository only persists the entity.
   * 
   * @param item - Item entity to save
   * @returns Saved item with database-generated fields
   */
  save(item: Item): Promise<Result<Item>>;

  /**
   * Delete item (soft delete: set status to DISCONTINUED)
   * 
   * Physical deletion not allowed for audit trail.
   * 
   * @param tenantId - Tenant isolation
   * @param itemId - Item UUID
   * @returns Success or failure
   */
  delete(tenantId: string, itemId: string): Promise<Result<void>>;

  /**
   * Check if item exists by SKU code
   * 
   * Used for uniqueness validation before save.
   * 
   * @param tenantId - Tenant isolation
   * @param skuCode - SKU code to check
   * @param excludeItemId - Optional item ID to exclude (for updates)
   * @returns True if exists, false otherwise
   */
  exists(
    tenantId: string,
    skuCode: string,
    excludeItemId?: string
  ): Promise<Result<boolean>>;
}
