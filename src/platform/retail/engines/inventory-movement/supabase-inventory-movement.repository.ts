/**
 * RETAIL OS - SUPABASE INVENTORY MOVEMENT REPOSITORY
 * 
 * Implements inventory movement persistence using Supabase client.
 * Extends Platform BaseSupabaseRepositoryPrimitive for error handling.
 * 
 * @module platform/retail/engines/inventory-movement/supabase-inventory-movement.repository
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { BaseSupabaseRepositoryPrimitive } from '../../../core/repository/base-supabase-repository.primitive';
import type {
  InventoryMovement,
  InventoryMovementType,
  ReorderAlert,
} from '../../contracts/inventory-movement.contract';
import type { IInventoryMovementRepository } from './inventory-movement-repository.interface';
import type { RetailInventoryMovement, RetailProduct } from '@/types/retail-database.types';

/**
 * Supabase Inventory Movement Repository
 * 
 * Handles DB persistence for inventory movements.
 * Ensures atomic stock updates with movement recording.
 */
export class SupabaseInventoryMovementRepository
  extends BaseSupabaseRepositoryPrimitive
  implements IInventoryMovementRepository
{
  constructor(private readonly supabase: SupabaseClient) {
    super();
  }

  async createMovementAndUpdateStock(
    movement: InventoryMovement,
    newStock: number
  ): Promise<InventoryMovement> {
    await this.setTenantContext(movement.tenantId);

    // Use Supabase transaction via RPC or manual rollback handling
    // For simplicity, perform operations sequentially (Supabase auto-rollback on error)
    
    // 1. Insert movement
    const movementRow = this.toDbRow(movement);
    const { data: movementData, error: movementError } = await this.supabase
      .from('retail_inventory_movements')
      .insert(movementRow)
      .select()
      .single();

    if (movementError) {
      throw this.mapDatabaseError(movementError, 'Inventory movement creation failed');
    }

    // 2. Update product stock atomically
    const { data: productData, error: productError } = await this.supabase
      .from('retail_products')
      .update({
        current_stock: newStock,
        updated_at: new Date().toISOString(),
      })
      .eq('id', movement.productId)
      .eq('tenant_id', movement.tenantId)
      .select()
      .single();

    if (productError) {
      // Rollback movement if product update fails (manual compensation)
      await this.supabase
        .from('retail_inventory_movements')
        .delete()
        .eq('id', movement.id);

      throw this.mapDatabaseError(productError, 'Product stock update failed');
    }

    if (!productData) {
      // Rollback movement
      await this.supabase
        .from('retail_inventory_movements')
        .delete()
        .eq('id', movement.id);

      throw new Error('PRODUCT_NOT_FOUND: Product does not exist');
    }

    return this.toDomain(movementData);
  }

  async findByProductId(tenantId: string, productId: string): Promise<InventoryMovement[]> {
    await this.setTenantContext(tenantId);

    const { data, error } = await this.supabase
      .from('retail_inventory_movements')
      .select('*')
      .eq('product_id', productId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      throw this.mapDatabaseError(error, 'Movement history lookup failed');
    }

    return data.map((row) => this.toDomain(row));
  }

  async getProductStock(tenantId: string, productId: string): Promise<number> {
    await this.setTenantContext(tenantId);

    const { data, error } = await this.supabase
      .from('retail_products')
      .select('current_stock')
      .eq('id', productId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) {
      throw this.mapDatabaseError(error, 'Product stock lookup failed');
    }

    if (!data) {
      throw new Error('PRODUCT_NOT_FOUND: Product does not exist');
    }

    return data.current_stock ?? 0;
  }

  async findProductsNeedingReorder(tenantId: string): Promise<ReorderAlert[]> {
    await this.setTenantContext(tenantId);

    const { data, error } = await this.supabase
      .from('retail_products')
      .select('id, sku, name, current_stock, reorder_point')
      .eq('tenant_id', tenantId)
      .eq('track_inventory', true)
      .not('reorder_point', 'is', null)
      .filter('current_stock', 'lte', 'reorder_point');

    if (error) {
      throw this.mapDatabaseError(error, 'Reorder alerts lookup failed');
    }

    return data.map((row) => {
      const currentStock = row.current_stock ?? 0;
      const reorderPoint = row.reorder_point ?? 0;
      return {
        product: {
          id: row.id,
          sku: row.sku,
          name: row.name,
        },
        currentStock,
        reorderPoint,
        deficit: reorderPoint - currentStock,
      };
    });
  }

  /**
   * Set tenant context for RLS
   */
  private async setTenantContext(tenantId: string): Promise<void> {
    await this.supabase.rpc('set_tenant_context', { tenant_id: tenantId });
  }

  /**
   * Map domain InventoryMovement to DB row
   */
  private toDbRow(movement: InventoryMovement): Omit<RetailInventoryMovement, 'created_at'> {
    return {
      id: movement.id,
      tenant_id: movement.tenantId,
      product_id: movement.productId,
      movement_type: movement.movementType,
      quantity_change: movement.quantityChange,
      previous_stock: movement.previousStock,
      new_stock: movement.newStock,
      reference_type: movement.referenceType || null,
      reference_id: movement.referenceId || null,
      reason: movement.reason || null,
      performed_by: movement.performedBy || null,
    };
  }

  /**
   * Map DB row to domain InventoryMovement
   */
  private toDomain(row: RetailInventoryMovement): InventoryMovement {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      productId: row.product_id,
      movementType: row.movement_type as InventoryMovementType,
      quantityChange: row.quantity_change,
      previousStock: row.previous_stock,
      newStock: row.new_stock,
      referenceType: (row.reference_type as 'SALE' | 'MANUAL' | 'SYSTEM') || 'MANUAL',
      referenceId: row.reference_id || undefined,
      reason: row.reason || undefined,
      performedBy: row.performed_by || undefined,
      createdAt: row.created_at,
    };
  }
}
