/**
 * Supabase Product Variant Repository (R3)
 * 
 * Supabase implementation of IProductVariantRepository
 * 
 * @module platform/retail/engines/product-variant
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { IProductVariantRepository } from './product-variant-repository.interface';
import type { ProductVariant } from '../../contracts/product-variant.contract';

/**
 * Database row type
 */
interface VariantRow {
  id: string;
  tenant_id: string;
  product_id: string;
  variant_sku: string;
  variant_attributes: Record<string, string>;
  current_stock: number;
  status: string;
  created_at: string;
  updated_at: string;
}

/**
 * Supabase Product Variant Repository
 */
export class SupabaseProductVariantRepository implements IProductVariantRepository {
  private readonly tableName = 'retail_product_variants';

  constructor(private readonly supabase: SupabaseClient) {
    // Set app.current_tenant_id for RLS
    // Note: This should be set at request context level in real app
  }

  async create(variant: Omit<ProductVariant, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProductVariant> {
    const row = {
      tenant_id: variant.tenantId,
      product_id: variant.productId,
      variant_sku: variant.variantSku,
      variant_attributes: variant.variantAttributes,
      current_stock: variant.currentStock,
      status: variant.status,
    };

    const { data, error } = await this.supabase
      .from(this.tableName)
      .insert(row)
      .select()
      .single();

    if (error) {
      throw new Error(`VARIANT_CREATE_FAILED: ${error.message}`);
    }

    return this.mapRowToEntity(data);
  }

  async update(variant: ProductVariant): Promise<ProductVariant> {
    const row = {
      variant_sku: variant.variantSku,
      variant_attributes: variant.variantAttributes,
      current_stock: variant.currentStock,
      status: variant.status,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from(this.tableName)
      .update(row)
      .eq('id', variant.id)
      .eq('tenant_id', variant.tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`VARIANT_UPDATE_FAILED: ${error.message}`);
    }

    return this.mapRowToEntity(data);
  }

  async findById(tenantId: string, variantId: string): Promise<ProductVariant | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('id', variantId)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`VARIANT_QUERY_FAILED: ${error.message}`);
    }

    return this.mapRowToEntity(data);
  }

  async findBySku(tenantId: string, variantSku: string): Promise<ProductVariant | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('variant_sku', variantSku)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`VARIANT_QUERY_FAILED: ${error.message}`);
    }

    return this.mapRowToEntity(data);
  }

  async findByProduct(
    tenantId: string,
    productId: string,
    includeDiscontinued = false
  ): Promise<ProductVariant[]> {
    let query = this.supabase
      .from(this.tableName)
      .select('*')
      .eq('product_id', productId)
      .eq('tenant_id', tenantId);

    if (!includeDiscontinued) {
      query = query.eq('status', 'ACTIVE');
    }

    const { data, error } = await query.order('created_at', { ascending: true });

    if (error) {
      throw new Error(`VARIANT_QUERY_FAILED: ${error.message}`);
    }

    return data.map(row => this.mapRowToEntity(row));
  }

  async getTotalStock(tenantId: string, productId: string): Promise<number> {
    const variants = await this.findByProduct(tenantId, productId, false);
    return variants.reduce((sum, v) => sum + v.currentStock, 0);
  }

  /**
   * Map database row to domain entity
   */
  private mapRowToEntity(row: VariantRow): ProductVariant {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      productId: row.product_id,
      variantSku: row.variant_sku,
      variantAttributes: row.variant_attributes,
      currentStock: row.current_stock,
      status: row.status as 'ACTIVE' | 'DISCONTINUED',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
