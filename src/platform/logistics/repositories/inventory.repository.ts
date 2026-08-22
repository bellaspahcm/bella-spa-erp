/**
 * Inventory Repository Implementation (Supabase)
 * 
 * Concrete implementation of IInventoryRepository using Supabase.
 * Maps between database schema and domain entities.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { Result } from '../domain/core/result';
import type { Inventory } from '../domain/inventory.types';
import type { 
  IInventoryRepository, 
  InventoryFilters,
  InventorySummary 
} from './inventory.repository.interface';

type LogisticsInventory = Database['logistics']['Tables']['inventory']['Row'];
type LogisticsInventoryInsert = Database['logistics']['Tables']['inventory']['Insert'];
type LogisticsInventoryUpdate = Database['logistics']['Tables']['inventory']['Update'];

export class InventoryRepository implements IInventoryRepository {
  constructor(private db: SupabaseClient<Database>) {}

  /**
   * Find inventory by ID
   */
  async findById(tenantId: string, inventoryId: string): Promise<Result<Inventory | null>> {
    try {
      const { data, error } = await this.db
        .from('inventory')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('id', inventoryId)
        .maybeSingle();

      if (error) {
        return Result.fail(`Database error: ${error.message}`, 'DB_ERROR');
      }

      if (!data) {
        return Result.ok(null);
      }

      return Result.ok(this.mapToDomain(data));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return Result.fail(`Failed to find inventory: ${message}`, 'REPOSITORY_ERROR');
    }
  }

  /**
   * Find inventory by unique combination
   */
  async findByUnique(
    tenantId: string,
    itemId: string,
    locationId: string,
    lotNumber: string | null,
    serialNumber: string | null
  ): Promise<Result<Inventory | null>> {
    try {
      let query = this.db
        .from('inventory')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('item_id', itemId)
        .eq('location_id', locationId);

      // Handle null lot/serial (need to use is() for null comparison)
      if (lotNumber === null) {
        query = query.is('lot_number', null);
      } else {
        query = query.eq('lot_number', lotNumber);
      }

      if (serialNumber === null) {
        query = query.is('serial_number', null);
      } else {
        query = query.eq('serial_number', serialNumber);
      }

      const { data, error } = await query.maybeSingle();

      if (error) {
        return Result.fail(`Database error: ${error.message}`, 'DB_ERROR');
      }

      if (!data) {
        return Result.ok(null);
      }

      return Result.ok(this.mapToDomain(data));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return Result.fail(`Failed to find inventory: ${message}`, 'REPOSITORY_ERROR');
    }
  }

  /**
   * List inventory with filters
   */
  async list(tenantId: string, filters?: InventoryFilters): Promise<Result<Inventory[]>> {
    try {
      let query = this.db
        .from('inventory')
        .select('*')
        .eq('tenant_id', tenantId);

      // Apply filters
      if (filters?.itemId) {
        query = query.eq('item_id', filters.itemId);
      }

      if (filters?.locationId) {
        query = query.eq('location_id', filters.locationId);
      }

      if (filters?.locationType) {
        query = query.eq('location_type', filters.locationType);
      }

      if (filters?.lotNumber) {
        query = query.eq('lot_number', filters.lotNumber);
      }

      if (filters?.serialNumber) {
        query = query.eq('serial_number', filters.serialNumber);
      }

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.minQuantityOnHand !== undefined) {
        query = query.gte('quantity_on_hand', filters.minQuantityOnHand);
      }

      if (filters?.maxQuantityOnHand !== undefined) {
        query = query.lte('quantity_on_hand', filters.maxQuantityOnHand);
      }

      // Order by item, location, lot, serial
      query = query.order('item_id').order('location_id').order('lot_number').order('serial_number');

      const { data, error } = await query;

      if (error) {
        return Result.fail(`Database error: ${error.message}`, 'DB_ERROR');
      }

      const inventories = data.map(row => this.mapToDomain(row));
      return Result.ok(inventories);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return Result.fail(`Failed to list inventory: ${message}`, 'REPOSITORY_ERROR');
    }
  }

  /**
   * Get inventory summary for an item
   */
  async getSummaryByItem(tenantId: string, itemId: string): Promise<Result<InventorySummary | null>> {
    try {
      const { data, error } = await this.db
        .from('inventory')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('item_id', itemId);

      if (error) {
        return Result.fail(`Database error: ${error.message}`, 'DB_ERROR');
      }

      if (!data || data.length === 0) {
        return Result.ok(null);
      }

      // Aggregate
      let totalOnHand = 0;
      let totalReserved = 0;
      const locationMap = new Map<string, {
        locationId: string;
        locationType: string;
        quantityOnHand: number;
        quantityReserved: number;
        quantityAvailable: number;
      }>();

      for (const row of data) {
        totalOnHand += row.quantity_on_hand;
        totalReserved += row.quantity_reserved;

        const key = row.location_id;
        const existing = locationMap.get(key);

        if (existing) {
          existing.quantityOnHand += row.quantity_on_hand;
          existing.quantityReserved += row.quantity_reserved;
          existing.quantityAvailable += row.quantity_available;
        } else {
          locationMap.set(key, {
            locationId: row.location_id,
            locationType: row.location_type,
            quantityOnHand: row.quantity_on_hand,
            quantityReserved: row.quantity_reserved,
            quantityAvailable: row.quantity_available,
          });
        }
      }

      const summary: InventorySummary = {
        itemId,
        totalOnHand,
        totalReserved,
        totalAvailable: totalOnHand - totalReserved,
        locationCount: locationMap.size,
        locations: Array.from(locationMap.values()),
      };

      return Result.ok(summary);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return Result.fail(`Failed to get inventory summary: ${message}`, 'REPOSITORY_ERROR');
    }
  }

  /**
   * Get inventory summary for a location
   */
  async getSummaryByLocation(tenantId: string, locationId: string): Promise<Result<InventorySummary[]>> {
    try {
      const { data, error } = await this.db
        .from('inventory')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('location_id', locationId);

      if (error) {
        return Result.fail(`Database error: ${error.message}`, 'DB_ERROR');
      }

      if (!data || data.length === 0) {
        return Result.ok([]);
      }

      // Group by item
      const itemMap = new Map<string, LogisticsInventory[]>();
      for (const row of data) {
        const existing = itemMap.get(row.item_id);
        if (existing) {
          existing.push(row);
        } else {
          itemMap.set(row.item_id, [row]);
        }
      }

      // Build summaries
      const summaries: InventorySummary[] = [];
      for (const [itemId, rows] of itemMap.entries()) {
        let totalOnHand = 0;
        let totalReserved = 0;

        for (const row of rows) {
          totalOnHand += row.quantity_on_hand;
          totalReserved += row.quantity_reserved;
        }

        summaries.push({
          itemId,
          totalOnHand,
          totalReserved,
          totalAvailable: totalOnHand - totalReserved,
          locationCount: 1, // Single location query
          locations: [{
            locationId,
            locationType: rows[0].location_type,
            quantityOnHand: totalOnHand,
            quantityReserved: totalReserved,
            quantityAvailable: totalOnHand - totalReserved,
          }],
        });
      }

      return Result.ok(summaries);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return Result.fail(`Failed to get location summary: ${message}`, 'REPOSITORY_ERROR');
    }
  }

  /**
   * Save inventory (insert or update)
   */
  async save(inventory: Inventory): Promise<Result<Inventory>> {
    try {
      // Check if inventory exists
      const existsResult = await this.findById(inventory.tenantId, inventory.id);
      if (existsResult.isFailure) {
        return existsResult as Result<Inventory>;
      }

      const exists = existsResult.value !== null;

      if (exists) {
        // Update
        const updateData = this.mapToUpdate(inventory);
        const { data, error } = await this.db
          .from('inventory')
          .update(updateData)
          .eq('tenant_id', inventory.tenantId)
          .eq('id', inventory.id)
          .select()
          .single();

        if (error) {
          return Result.fail(`Database error: ${error.message}`, 'DB_ERROR');
        }

        return Result.ok(this.mapToDomain(data));
      } else {
        // Insert
        const insertData = this.mapToInsert(inventory);
        const { data, error } = await this.db
          .from('inventory')
          .insert(insertData)
          .select()
          .single();

        if (error) {
          // Check for unique violation
          if (error.code === '23505') {
            return Result.fail(
              'Inventory record already exists for this item/location/lot/serial combination',
              'INVENTORY_DUPLICATE'
            );
          }

          return Result.fail(`Database error: ${error.message}`, 'DB_ERROR');
        }

        return Result.ok(this.mapToDomain(data));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return Result.fail(`Failed to save inventory: ${message}`, 'REPOSITORY_ERROR');
    }
  }

  /**
   * Save multiple inventory records (batch operation)
   */
  async saveBatch(inventories: Inventory[]): Promise<Result<Inventory[]>> {
    // NOTE: Supabase doesn't have native upsert with conflict resolution on complex unique constraints.
    // For E7.1, implement as sequential saves. Optimize with transaction in future if needed.
    
    try {
      const savedInventories: Inventory[] = [];

      for (const inventory of inventories) {
        const saveResult = await this.save(inventory);
        if (saveResult.isFailure) {
          return saveResult as Result<Inventory[]>;
        }
        savedInventories.push(saveResult.value);
      }

      return Result.ok(savedInventories);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return Result.fail(`Failed to save batch: ${message}`, 'REPOSITORY_ERROR');
    }
  }

  /**
   * Delete inventory record
   */
  async delete(tenantId: string, inventoryId: string): Promise<Result<void>> {
    try {
      const { error } = await this.db
        .from('inventory')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('id', inventoryId);

      if (error) {
        return Result.fail(`Database error: ${error.message}`, 'DB_ERROR');
      }

      return Result.ok(undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return Result.fail(`Failed to delete inventory: ${message}`, 'REPOSITORY_ERROR');
    }
  }

  /**
   * Check if item has any inventory
   */
  async hasInventory(tenantId: string, itemId: string): Promise<Result<boolean>> {
    try {
      const { count, error } = await this.db
        .from('inventory')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('item_id', itemId)
        .gt('quantity_on_hand', 0);

      if (error) {
        return Result.fail(`Database error: ${error.message}`, 'DB_ERROR');
      }

      return Result.ok((count ?? 0) > 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return Result.fail(`Failed to check inventory: ${message}`, 'REPOSITORY_ERROR');
    }
  }

  /**
   * Map database row to domain entity
   */
  private mapToDomain(row: LogisticsInventory): Inventory {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      itemId: row.item_id,
      locationId: row.location_id,
      locationType: row.location_type as 'WAREHOUSE' | 'STORE' | 'FULFILLMENT' | '3PL' | 'TRANSIT' | 'SUPPLIER' | 'CUSTOMER' | 'STAGING' | 'QUARANTINE' | 'DAMAGE' | 'VIRTUAL',
      
      quantityOnHand: row.quantity_on_hand,
      quantityReserved: row.quantity_reserved,
      quantityAvailable: row.quantity_available,
      
      lotNumber: row.lot_number,
      serialNumber: row.serial_number,
      expiryDate: row.expiry_date ? new Date(row.expiry_date) : null,
      
      status: row.status as 'AVAILABLE' | 'RESERVED' | 'ALLOCATED' | 'QUARANTINE' | 'DAMAGED' | 'EXPIRED' | 'TRANSIT' | 'BLOCKED',
      
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Map domain entity to database insert
   */
  private mapToInsert(inventory: Inventory): LogisticsInventoryInsert {
    return {
      id: inventory.id,
      tenant_id: inventory.tenantId,
      item_id: inventory.itemId,
      location_id: inventory.locationId,
      location_type: inventory.locationType,
      
      quantity_on_hand: inventory.quantityOnHand,
      quantity_reserved: inventory.quantityReserved,
      quantity_available: inventory.quantityAvailable,
      
      lot_number: inventory.lotNumber,
      serial_number: inventory.serialNumber,
      expiry_date: inventory.expiryDate?.toISOString() || null,
      
      status: inventory.status,
      
      created_at: inventory.createdAt.toISOString(),
      updated_at: inventory.updatedAt.toISOString(),
    };
  }

  /**
   * Map domain entity to database update
   */
  private mapToUpdate(inventory: Inventory): LogisticsInventoryUpdate {
    return {
      quantity_on_hand: inventory.quantityOnHand,
      quantity_reserved: inventory.quantityReserved,
      quantity_available: inventory.quantityAvailable,
      
      expiry_date: inventory.expiryDate?.toISOString() || null,
      
      status: inventory.status,
      
      updated_at: inventory.updatedAt.toISOString(),
    };
  }
}
