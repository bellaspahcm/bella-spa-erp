/**
 * Product Variant Repository Interface (R3)
 * 
 * Data access abstraction for retail_product_variants table
 * 
 * @module platform/retail/engines/product-variant
 */

import type { ProductVariant } from '../../contracts/product-variant.contract';

/**
 * Product Variant Repository Interface
 * 
 * Defines data access operations for product variants
 */
export interface IProductVariantRepository {
  /**
   * Create a variant
   */
  create(variant: Omit<ProductVariant, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProductVariant>;

  /**
   * Update a variant
   */
  update(variant: ProductVariant): Promise<ProductVariant>;

  /**
   * Find variant by ID
   */
  findById(tenantId: string, variantId: string): Promise<ProductVariant | null>;

  /**
   * Find variant by SKU
   */
  findBySku(tenantId: string, variantSku: string): Promise<ProductVariant | null>;

  /**
   * Find all variants for a product
   */
  findByProduct(tenantId: string, productId: string, includeDiscontinued?: boolean): Promise<ProductVariant[]>;

  /**
   * Get total stock across all variants of a product
   */
  getTotalStock(tenantId: string, productId: string): Promise<number>;
}
