/**
 * Product Variant Engine (R3)
 * 
 * Implements product variant management business logic
 * 
 * @module platform/retail/engines/product-variant
 */

import type {
  IProductVariantContract,
  ProductVariant,
  CreateVariantRequest,
  UpdateVariantStockRequest,
} from '../../contracts/product-variant.contract';
import type { IProductVariantRepository } from './product-variant-repository.interface';

/**
 * Product Variant Engine
 * 
 * Implements R3 contract with business logic and validation
 */
export class ProductVariantEngine implements IProductVariantContract {
  constructor(private readonly repository: IProductVariantRepository) {}

  async createVariant(request: CreateVariantRequest): Promise<ProductVariant> {
    // Validation
    if (!request.tenantId) {
      throw new Error('TENANT_ISOLATION_VIOLATION: tenantId required');
    }

    if (!request.productId) {
      throw new Error('PRODUCT_NOT_FOUND: productId required');
    }

    if (!request.variantAttributes || Object.keys(request.variantAttributes).length === 0) {
      throw new Error('VARIANT_CREATE_FAILED: variant_attributes cannot be empty');
    }

    // Auto-generate variantSku if not provided
    const variantSku = request.variantSku || this.generateVariantSku(request.variantAttributes);

    // Check SKU uniqueness
    const existing = await this.repository.findBySku(request.tenantId, variantSku);
    if (existing) {
      throw new Error(`VARIANT_CREATE_FAILED: variant_sku '${variantSku}' already exists`);
    }

    // Create variant
    const variant: Omit<ProductVariant, 'id' | 'createdAt' | 'updatedAt'> = {
      tenantId: request.tenantId,
      productId: request.productId,
      variantSku,
      variantAttributes: request.variantAttributes,
      currentStock: request.initialStock ?? 0,
      status: request.status ?? 'ACTIVE',
    };

    return this.repository.create(variant);
  }

  async getVariantsByProduct(
    tenantId: string,
    productId: string,
    includeDiscontinued = false
  ): Promise<ProductVariant[]> {
    if (!tenantId) {
      throw new Error('TENANT_ISOLATION_VIOLATION: tenantId required');
    }

    return this.repository.findByProduct(tenantId, productId, includeDiscontinued);
  }

  async getVariantBySku(tenantId: string, variantSku: string): Promise<ProductVariant | null> {
    if (!tenantId) {
      throw new Error('TENANT_ISOLATION_VIOLATION: tenantId required');
    }

    return this.repository.findBySku(tenantId, variantSku);
  }

  async getVariantById(tenantId: string, variantId: string): Promise<ProductVariant | null> {
    if (!tenantId) {
      throw new Error('TENANT_ISOLATION_VIOLATION: tenantId required');
    }

    return this.repository.findById(tenantId, variantId);
  }

  async updateVariantStock(request: UpdateVariantStockRequest): Promise<ProductVariant> {
    if (!request.tenantId) {
      throw new Error('TENANT_ISOLATION_VIOLATION: tenantId required');
    }

    if (request.newStock < 0) {
      throw new Error('NEGATIVE_STOCK_ERROR: stock cannot be negative');
    }

    const variant = await this.repository.findById(request.tenantId, request.variantId);
    if (!variant) {
      throw new Error('VARIANT_NOT_FOUND: variant does not exist');
    }

    variant.currentStock = request.newStock;
    return this.repository.update(variant);
  }

  async getTotalVariantStock(tenantId: string, productId: string): Promise<number> {
    if (!tenantId) {
      throw new Error('TENANT_ISOLATION_VIOLATION: tenantId required');
    }

    return this.repository.getTotalStock(tenantId, productId);
  }

  /**
   * Generate variant SKU from attributes
   * 
   * Example: {size: '4T', color: 'red'} → '4T-RED'
   */
  private generateVariantSku(attributes: Record<string, string>): string {
    return Object.values(attributes)
      .map(v => v.toUpperCase().replace(/\s+/g, '-'))
      .join('-');
  }
}
