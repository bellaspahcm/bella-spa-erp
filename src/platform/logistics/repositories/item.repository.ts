/**
 * Item Repository Implementation (Supabase)
 * 
 * Concrete implementation of IItemRepository using Supabase.
 * Maps between database schema and domain entities.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { Result } from '../domain/core/result';
import type { Item } from '../domain/item.types';
import type { IItemRepository, ItemFilters } from './item.repository.interface';

type LogisticsItem = Database['logistics']['Tables']['items']['Row'];
type LogisticsItemInsert = Database['logistics']['Tables']['items']['Insert'];
type LogisticsItemUpdate = Database['logistics']['Tables']['items']['Update'];

export class ItemRepository implements IItemRepository {
  constructor(private db: SupabaseClient<Database>) {}

  /**
   * Find item by ID
   */
  async findById(tenantId: string, itemId: string): Promise<Result<Item | null>> {
    try {
      const { data, error } = await this.db
        .from('items')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('id', itemId)
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
      return Result.fail(`Failed to find item: ${message}`, 'REPOSITORY_ERROR');
    }
  }

  /**
   * Find item by SKU code
   */
  async findBySkuCode(tenantId: string, skuCode: string): Promise<Result<Item | null>> {
    try {
      const { data, error } = await this.db
        .from('items')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('sku_code', skuCode)
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
      return Result.fail(`Failed to find item by SKU: ${message}`, 'REPOSITORY_ERROR');
    }
  }

  /**
   * List items with filters
   */
  async list(tenantId: string, filters?: ItemFilters): Promise<Result<Item[]>> {
    try {
      let query = this.db
        .from('items')
        .select('*')
        .eq('tenant_id', tenantId);

      // Apply filters
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.type) {
        query = query.eq('type', filters.type);
      }

      if (filters?.category) {
        query = query.eq('category', filters.category);
      }

      if (filters?.lotTracked !== undefined) {
        query = query.eq('lot_tracked', filters.lotTracked);
      }

      if (filters?.serialTracked !== undefined) {
        query = query.eq('serial_tracked', filters.serialTracked);
      }

      if (filters?.skuCodePattern) {
        query = query.ilike('sku_code', filters.skuCodePattern);
      }

      // Order by SKU code
      query = query.order('sku_code', { ascending: true });

      const { data, error } = await query;

      if (error) {
        return Result.fail(`Database error: ${error.message}`, 'DB_ERROR');
      }

      const items = data.map(row => this.mapToDomain(row));
      return Result.ok(items);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return Result.fail(`Failed to list items: ${message}`, 'REPOSITORY_ERROR');
    }
  }

  /**
   * Save item (insert or update)
   */
  async save(item: Item): Promise<Result<Item>> {
    try {
      // Check if item exists
      const existsResult = await this.findById(item.tenant_id, item.id.value);
      if (existsResult.isFailure) {
        return existsResult as Result<Item>;
      }

      const exists = existsResult.value !== null;

      if (exists) {
        // Update
        const updateData = this.mapToUpdate(item);
        const { data, error } = await this.db
          .from('items')
          .update(updateData)
          .eq('tenant_id', item.tenant_id)
          .eq('id', item.id.value)
          .select()
          .single();

        if (error) {
          return Result.fail(`Database error: ${error.message}`, 'DB_ERROR');
        }

        return Result.ok(this.mapToDomain(data));
      } else {
        // Insert
        const insertData = this.mapToInsert(item);
        const { data, error } = await this.db
          .from('items')
          .insert(insertData)
          .select()
          .single();

        if (error) {
          // Check for unique violation
          if (error.code === '23505') {
            return Result.fail(
              `Item with SKU code '${item.sku_code.value}' already exists`,
              'ITEM_SKU_DUPLICATE'
            );
          }

          return Result.fail(`Database error: ${error.message}`, 'DB_ERROR');
        }

        return Result.ok(this.mapToDomain(data));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return Result.fail(`Failed to save item: ${message}`, 'REPOSITORY_ERROR');
    }
  }

  /**
   * Delete item (soft delete)
   */
  async delete(tenantId: string, itemId: string): Promise<Result<void>> {
    try {
      const { error } = await this.db
        .from('items')
        .update({ status: 'DISCONTINUED', updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId)
        .eq('id', itemId);

      if (error) {
        return Result.fail(`Database error: ${error.message}`, 'DB_ERROR');
      }

      return Result.ok(undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return Result.fail(`Failed to delete item: ${message}`, 'REPOSITORY_ERROR');
    }
  }

  /**
   * Check if item exists by SKU code
   */
  async exists(
    tenantId: string,
    skuCode: string,
    excludeItemId?: string
  ): Promise<Result<boolean>> {
    try {
      let query = this.db
        .from('items')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('sku_code', skuCode);

      if (excludeItemId) {
        query = query.neq('id', excludeItemId);
      }

      const { count, error } = await query;

      if (error) {
        return Result.fail(`Database error: ${error.message}`, 'DB_ERROR');
      }

      return Result.ok((count ?? 0) > 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return Result.fail(`Failed to check item existence: ${message}`, 'REPOSITORY_ERROR');
    }
  }

  /**
   * Map database row to domain entity
   */
  private mapToDomain(row: LogisticsItem): Item {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      skuCode: row.sku_code,
      name: row.name,
      description: row.description,
      
      type: row.type as 'GOODS' | 'SERVICE' | 'ASSET' | 'VIRTUAL',
      category: row.category,
      
      baseUom: row.base_uom,
      weightKg: row.weight_kg,
      dimensionsJson: row.dimensions_json as Record<string, unknown> | null,
      
      standardCost: row.standard_cost,
      currency: row.currency,
      
      lotTracked: row.lot_tracked,
      serialTracked: row.serial_tracked,
      expiryTracked: row.expiry_tracked,
      
      status: row.status as 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED',
      
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      createdBy: row.created_by,
      updatedBy: row.updated_by,
    };
  }

  /**
   * Map domain entity to database insert
   */
  private mapToInsert(item: Item): LogisticsItemInsert {
    return {
      id: item.id.value,
      tenant_id: item.tenant_id,
      sku_code: item.sku_code.value,
      name: item.name,
      description: item.description,
      
      type: item.type,
      category: item.category,
      
      base_uom: item.base_uom,
      weight_kg: item.weight_kg,
      dimensions_json: (item.dimensions ?? null) as Record<string, unknown> | null,
      
      standard_cost: item.standard_cost,
      currency: item.currency,
      
      lot_tracked: item.lot_tracked,
      serial_tracked: item.serial_tracked,
      expiry_tracked: item.expiry_tracked,
      
      status: item.status,
      
      created_at: item.created_at.toISOString(),
      updated_at: item.updated_at.toISOString(),
      created_by: item.created_by,
      updated_by: item.updated_by,
    };
  }

  /**
   * Map domain entity to database update
   */
  private mapToUpdate(item: Item): LogisticsItemUpdate {
    return {
      name: item.name,
      description: item.description,
      
      type: item.type,
      category: item.category,
      
      base_uom: item.base_uom,
      weight_kg: item.weight_kg,
      dimensions_json: (item.dimensions ?? null) as Record<string, unknown> | null,
      
      standard_cost: item.standard_cost,
      currency: item.currency,
      
      lot_tracked: item.lot_tracked,
      serial_tracked: item.serial_tracked,
      expiry_tracked: item.expiry_tracked,
      
      status: item.status,
      
      updated_at: item.updated_at.toISOString(),
      updated_by: item.updated_by,
    };
  }
}
