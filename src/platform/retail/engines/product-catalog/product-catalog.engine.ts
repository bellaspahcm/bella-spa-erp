/**
 * RETAIL OS - PRODUCT CATALOG ENGINE (R1)
 * 
 * Implements frozen IProductCatalogContract.
 * Encapsulates product lifecycle domain logic.
 * 
 * @module platform/retail/engines/product-catalog/product-catalog.engine
 */

import { randomUUID } from 'crypto';
import type {
  IProductCatalogContract,
  Product,
  CreateProductRequest,
  UpdateProductPriceRequest,
  UpdateProductStatusRequest,
} from '../../contracts/product-catalog.contract';
import type { IProductCatalogRepository } from './product-catalog-repository.interface';

/**
 * Product Catalog Engine (R1)
 * 
 * Implements Retail OS product management semantics:
 * - Product CRUD with SKU identity
 * - Status lifecycle (ACTIVE/DISCONTINUED/OUT_OF_STOCK)
 * - Pricing attributes (base/cost)
 * 
 * Invariants enforced:
 * - SKU unique per tenant (DB constraint)
 * - Price positivity
 * - Status transition rules (DISCONTINUED final)
 */
export class ProductCatalogEngine implements IProductCatalogContract {
  constructor(private readonly repository: IProductCatalogRepository) {}

  async createProduct(request: CreateProductRequest): Promise<Product> {
    // Validate tenant isolation
    if (!request.tenantId) {
      throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    }

    // Validate price positivity
    if (request.basePrice <= 0) {
      throw new Error('INVALID_PRICE: basePrice must be positive');
    }

    if (request.costPrice !== undefined && request.costPrice < 0) {
      throw new Error('INVALID_COST_PRICE: costPrice must be non-negative');
    }

    // Build product entity
    const product: Product = {
      id: randomUUID(),
      tenantId: request.tenantId,
      sku: request.sku,
      name: request.name,
      description: request.description,
      category: request.category,
      basePrice: request.basePrice,
      costPrice: request.costPrice,
      trackInventory: request.trackInventory ?? true,
      currentStock: request.currentStock ?? 0,
      reorderPoint: request.reorderPoint,
      status: request.status || 'ACTIVE',
      createdBy: request.userId,
      updatedBy: request.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Persist (repository handles SKU uniqueness constraint)
    return await this.repository.create(product);
  }

  async updateProductPrice(request: UpdateProductPriceRequest): Promise<Product> {
    // Validate tenant isolation
    if (!request.tenantId) {
      throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    }

    // Validate price positivity
    if (request.basePrice <= 0) {
      throw new Error('INVALID_PRICE: basePrice must be positive');
    }

    // Update price via repository
    return await this.repository.updatePrice(
      request.tenantId,
      request.productId,
      request.basePrice,
      request.userId
    );
  }

  async updateProductStatus(request: UpdateProductStatusRequest): Promise<Product> {
    // Validate tenant isolation
    if (!request.tenantId) {
      throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    }

    // Check current status to enforce transition rules
    const currentProduct = await this.repository.findById(request.tenantId, request.productId);

    if (!currentProduct) {
      throw new Error('PRODUCT_NOT_FOUND: Product does not exist');
    }

    // Invariant: DISCONTINUED is final (no reversal to ACTIVE)
    if (currentProduct.status === 'DISCONTINUED' && request.status !== 'DISCONTINUED') {
      throw new Error(
        'INVALID_STATUS_TRANSITION: Cannot change status from DISCONTINUED (final state)'
      );
    }

    // Update status via repository
    return await this.repository.updateStatus(
      request.tenantId,
      request.productId,
      request.status,
      request.userId
    );
  }

  async getProductById(tenantId: string, productId: string): Promise<Product | null> {
    // Validate tenant isolation
    if (!tenantId) {
      throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    }

    return await this.repository.findById(tenantId, productId);
  }

  async getProductBySku(tenantId: string, sku: string): Promise<Product | null> {
    // Validate tenant isolation
    if (!tenantId) {
      throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    }

    return await this.repository.findBySku(tenantId, sku);
  }
}
