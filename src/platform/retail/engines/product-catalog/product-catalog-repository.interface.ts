/**
 * RETAIL OS - PRODUCT CATALOG REPOSITORY INTERFACE
 * 
 * Repository interface for product persistence.
 * Separates domain logic from infrastructure.
 * 
 * @module platform/retail/engines/product-catalog/product-catalog-repository.interface
 */

import type { Product, ProductStatus } from '../../contracts/product-catalog.contract';

/**
 * Product Repository Interface
 * 
 * Defines persistence operations for product entities.
 * Implementation handles DB access, RLS, error mapping.
 */
export interface IProductCatalogRepository {
  /**
   * Create new product
   */
  create(product: Product): Promise<Product>;

  /**
   * Update existing product
   */
  update(product: Product): Promise<Product>;

  /**
   * Find product by ID
   */
  findById(tenantId: string, productId: string): Promise<Product | null>;

  /**
   * Find product by SKU
   */
  findBySku(tenantId: string, sku: string): Promise<Product | null>;

  /**
   * Update product price
   */
  updatePrice(tenantId: string, productId: string, basePrice: number, userId?: string): Promise<Product>;

  /**
   * Update product status
   */
  updateStatus(tenantId: string, productId: string, status: ProductStatus, userId?: string): Promise<Product>;
}
