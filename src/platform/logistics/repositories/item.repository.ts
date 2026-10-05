/**
 * Item Repository Implementation (Supabase)
 * 
 * Concrete implementation of IItemRepository using Supabase.
 * Maps between database schema and domain entities.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database.types';
import { Result } from '../domain/core/result';
import type { Item } from '../domain/item.types';
import type { IItemRepository, ItemFilters } from './item.repository.interface';

type LogisticsItem = Database['public']['Tables']['items']['Row'];
type LogisticsItemInsert = Database['public']['Tables']['items']['Insert'];
type LogisticsItemUpdate = Database['public']['Tables']['items']['Update'];

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
      const existsResult = await this.findById(item.tenantId, item.id.value);
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
          .eq('tenant_id', item.tenantId)
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
              `Item with SKU code '${item.skuCode}' already exists`,
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
      id: { value: row.id },
      tenantId: row.tenant_id,
      skuCode: row.sku_code,
      name: row.name,
      description: row.description,
      
      type: row.type as Item['type'],
      category: row.category,
      
      baseUom: row.base_uom as Item['baseUom'],
      weightKg: row.weight_kg,
      dimensionsJson: mapDimensionsFromJson(row.dimensions_json),
      
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
      tenant_id: item.tenantId,
      sku_code: item.skuCode,
      name: item.name,
      description: item.description,
      
      type: item.type,
      category: item.category,
      
      base_uom: item.baseUom,
      weight_kg: item.weightKg,
      dimensions_json: mapDimensionsToJson(item.dimensionsJson),
      
      standard_cost: item.standardCost ?? 0,
      currency: item.currency,
      
      lot_tracked: item.lotTracked,
      serial_tracked: item.serialTracked,
      expiry_tracked: item.expiryTracked,
      
      status: item.status,
      
      created_at: item.createdAt.toISOString(),
      updated_at: item.updatedAt.toISOString(),
      created_by: item.createdBy,
      updated_by: item.updatedBy,
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
      
      base_uom: item.baseUom,
      weight_kg: item.weightKg,
      dimensions_json: mapDimensionsToJson(item.dimensionsJson),
      
      standard_cost: item.standardCost ?? 0,
      currency: item.currency,
      
      lot_tracked: item.lotTracked,
      serial_tracked: item.serialTracked,
      expiry_tracked: item.expiryTracked,
      
      status: item.status,
      
      updated_at: item.updatedAt.toISOString(),
      updated_by: item.updatedBy,
    };
  }
}

function mapDimensionsToJson(dimensions: Item['dimensionsJson']): Json | null {
  if (!dimensions) {
    return null;
  }

  return {
    length: dimensions.length,
    width: dimensions.width,
    height: dimensions.height,
    unit: dimensions.unit,
  };
}

function mapDimensionsFromJson(value: Json | null): Item['dimensionsJson'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, Json | undefined>;
  const { length, width, height, unit } = record;

  if (
    typeof length !== 'number' ||
    typeof width !== 'number' ||
    typeof height !== 'number' ||
    (unit !== 'CM' && unit !== 'IN' && unit !== 'M' && unit !== 'FT')
  ) {
    return null;
  }

  return { length, width, height, unit };
}
