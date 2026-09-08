/**
 * RETAIL OS - SUPABASE PRODUCT CATALOG REPOSITORY
 * 
 * Implements product persistence using Supabase client.
 * Extends Platform BaseSupabaseRepositoryPrimitive for error handling.
 * 
 * @module platform/retail/engines/product-catalog/supabase-product-catalog.repository
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { BaseSupabaseRepositoryPrimitive } from '../../../core/repository/base-supabase-repository.primitive';
import type { Product, ProductStatus } from '../../contracts/product-catalog.contract';
import type { IProductCatalogRepository } from './product-catalog-repository.interface';
import type { RetailProduct } from '@/types/retail-database.types';

/**
 * Supabase Product Catalog Repository
 * 
 * Handles DB persistence for product entities.
 * Maps between domain Product and DB RetailProduct.
 */
export class SupabaseProductCatalogRepository
  extends BaseSupabaseRepositoryPrimitive
  implements IProductCatalogRepository
{
  constructor(private readonly supabase: SupabaseClient) {
    super();
  }

  async create(product: Product): Promise<Product> {
    await this.setTenantContext(product.tenantId);

    const dbRow = this.toDbRow(product);

    const { data, error } = await this.supabase
      .from('retail_products')
      .insert(dbRow)
      .select()
      .single();

    if (error) {
      throw this.mapDatabaseError(error, 'Product creation failed');
    }

    return this.toDomain(data);
  }

  async update(product: Product): Promise<Product> {
    await this.setTenantContext(product.tenantId);

    const dbRow = this.toDbRow(product);

    const { data, error } = await this.supabase
      .from('retail_products')
      .update({
        sku: dbRow.sku,
        name: dbRow.name,
        description: dbRow.description,
        category: dbRow.category,
        base_price: dbRow.base_price,
        cost_price: dbRow.cost_price,
        track_inventory: dbRow.track_inventory,
        current_stock: dbRow.current_stock,
        reorder_point: dbRow.reorder_point,
        status: dbRow.status,
        updated_by: dbRow.updated_by,
        updated_at: new Date().toISOString(),
      })
      .eq('id', product.id)
      .eq('tenant_id', product.tenantId)
      .select()
      .single();

    if (error) {
      throw this.mapDatabaseError(error, 'Product update failed');
    }

    if (!data) {
      throw new Error('PRODUCT_NOT_FOUND: Product does not exist or update failed');
    }

    return this.toDomain(data);
  }

  async findById(tenantId: string, productId: string): Promise<Product | null> {
    await this.setTenantContext(tenantId);

    const { data, error } = await this.supabase
      .from('retail_products')
      .select('*')
      .eq('id', productId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) {
      throw this.mapDatabaseError(error, 'Product lookup failed');
    }

    return data ? this.toDomain(data) : null;
  }

  async findBySku(tenantId: string, sku: string): Promise<Product | null> {
    await this.setTenantContext(tenantId);

    const { data, error } = await this.supabase
      .from('retail_products')
      .select('*')
      .eq('sku', sku)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) {
      throw this.mapDatabaseError(error, 'Product lookup by SKU failed');
    }

    return data ? this.toDomain(data) : null;
  }

  async updatePrice(
    tenantId: string,
    productId: string,
    basePrice: number,
    userId?: string
  ): Promise<Product> {
    await this.setTenantContext(tenantId);

    const { data, error } = await this.supabase
      .from('retail_products')
      .update({
        base_price: basePrice,
        updated_by: userId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw this.mapDatabaseError(error, 'Product price update failed');
    }

    if (!data) {
      throw new Error('PRODUCT_NOT_FOUND: Product does not exist');
    }

    return this.toDomain(data);
  }

  async updateStatus(
    tenantId: string,
    productId: string,
    status: ProductStatus,
    userId?: string
  ): Promise<Product> {
    await this.setTenantContext(tenantId);

    const { data, error } = await this.supabase
      .from('retail_products')
      .update({
        status,
        updated_by: userId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw this.mapDatabaseError(error, 'Product status update failed');
    }

    if (!data) {
      throw new Error('PRODUCT_NOT_FOUND: Product does not exist');
    }

    return this.toDomain(data);
  }

  /**
   * Set tenant context for RLS
   */
  private async setTenantContext(tenantId: string): Promise<void> {
    await this.supabase.rpc('set_tenant_context', { tenant_id: tenantId });
  }

  /**
   * Map domain Product to DB row
   */
  private toDbRow(product: Product): Omit<RetailProduct, 'created_at' | 'updated_at'> {
    return {
      id: product.id,
      tenant_id: product.tenantId,
      sku: product.sku,
      name: product.name,
      description: product.description || null,
      category: product.category,
      base_price: product.basePrice,
      cost_price: product.costPrice || null,
      track_inventory: product.trackInventory,
      current_stock: product.currentStock,
      reorder_point: product.reorderPoint || null,
      status: product.status,
      created_by: product.createdBy || null,
      updated_by: product.updatedBy || null,
    };
  }

  /**
   * Map DB row to domain Product
   */
  private toDomain(row: RetailProduct): Product {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      sku: row.sku,
      name: row.name,
      description: row.description || undefined,
      category: row.category,
      basePrice: row.base_price,
      costPrice: row.cost_price || undefined,
      trackInventory: row.track_inventory,
      currentStock: row.current_stock ?? 0,
      reorderPoint: row.reorder_point || undefined,
      status: row.status,
      createdBy: row.created_by || undefined,
      updatedBy: row.updated_by || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
