/**
 * BELLA RETAIL STORE - PRODUCT CATALOG SERVICE
 * 
 * W1: Product Catalog & Availability
 * - Create Product, set price/status, check availability/reorder
 * - Migrated to use Retail OS R1 Product Catalog Contract
 * 
 * Architecture: Product -> R1 Contract -> R1 Engine -> Repository
 * Tenant Isolation: Enforced by R1 engine
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { RetailProduct } from '@/types/retail-database.types';
import type { IProductCatalogContract } from '@/platform/retail/contracts/product-catalog.contract';

export interface CreateProductRequest {
  tenantId: string;
  sku: string;
  name: string;
  description?: string;
  category: string;
  basePrice: number;
  costPrice?: number;
  trackInventory?: boolean;
  currentStock?: number;
  reorderPoint?: number;
  status?: 'ACTIVE' | 'DISCONTINUED' | 'OUT_OF_STOCK';
  userId?: string;
}

export interface UpdateProductPriceRequest {
  tenantId: string;
  productId: string;
  basePrice: number;
  userId?: string;
}

export interface UpdateProductStatusRequest {
  tenantId: string;
  productId: string;
  status: 'ACTIVE' | 'DISCONTINUED' | 'OUT_OF_STOCK';
  userId?: string;
}

export interface CheckAvailabilityRequest {
  tenantId: string;
  productId: string;
  requestedQuantity: number;
}

export interface AvailabilityResult {
  available: boolean;
  currentStock: number;
  requestedQuantity: number;
  needsReorder: boolean;
  reorderPoint?: number;
}

export class ProductCatalogService {
  constructor(
    private readonly productCatalogEngine: IProductCatalogContract,
    private readonly supabase: SupabaseClient // Kept for orchestration queries
  ) {}

  /**
   * W1.1: Create Product with pricing and inventory settings
   * MIGRATED: Now uses R1 Product Catalog contract
   */
  async createProduct(request: CreateProductRequest): Promise<RetailProduct> {
    // Delegate to R1 engine
    const product = await this.productCatalogEngine.createProduct({
      tenantId: request.tenantId,
      sku: request.sku,
      name: request.name,
      description: request.description,
      category: request.category,
      basePrice: request.basePrice,
      costPrice: request.costPrice,
      trackInventory: request.trackInventory,
      currentStock: request.currentStock,
      reorderPoint: request.reorderPoint,
      status: request.status,
      userId: request.userId,
    });

    // Map domain Product to RetailProduct (DB type)
    return this.mapToRetailProduct(product);
  }

  /**
   * W1.2: Update product price
   * MIGRATED: Now uses R1 Product Catalog contract
   */
  async updateProductPrice(request: UpdateProductPriceRequest): Promise<RetailProduct> {
    const product = await this.productCatalogEngine.updateProductPrice({
      tenantId: request.tenantId,
      productId: request.productId,
      basePrice: request.basePrice,
      userId: request.userId,
    });

    return this.mapToRetailProduct(product);
  }

  /**
   * W1.3: Update product status
   * MIGRATED: Now uses R1 Product Catalog contract
   */
  async updateProductStatus(request: UpdateProductStatusRequest): Promise<RetailProduct> {
    const product = await this.productCatalogEngine.updateProductStatus({
      tenantId: request.tenantId,
      productId: request.productId,
      status: request.status,
      userId: request.userId,
    });

    return this.mapToRetailProduct(product);
  }

  /**
   * W1.4: Check product availability and reorder status
   * ORCHESTRATION: Composes R1.getProductById() with availability logic
   * This is Product-specific business logic, NOT canonical Retail Core
   */
  async checkAvailability(request: CheckAvailabilityRequest): Promise<AvailabilityResult> {
    // Use R1 to get product
    const product = await this.productCatalogEngine.getProductById(request.tenantId, request.productId);

    if (!product) {
      throw new Error('PRODUCT_NOT_FOUND: Product does not exist');
    }

    if (!product.trackInventory) {
      // Non-tracked inventory is always available
      return {
        available: true,
        currentStock: 0,
        requestedQuantity: request.requestedQuantity,
        needsReorder: false,
      };
    }

    const currentStock = product.currentStock ?? 0;
    const available = currentStock >= request.requestedQuantity && product.status === 'ACTIVE';
    const needsReorder = product.reorderPoint !== undefined && currentStock <= product.reorderPoint;

    return {
      available,
      currentStock,
      requestedQuantity: request.requestedQuantity,
      needsReorder,
      reorderPoint: product.reorderPoint,
    };
  }

  /**
   * Get product by ID
   * MIGRATED: Now uses R1 Product Catalog contract
   */
  async getProductById(tenantId: string, productId: string): Promise<RetailProduct | null> {
    const product = await this.productCatalogEngine.getProductById(tenantId, productId);
    
    if (!product) return null;
    return this.mapToRetailProduct(product);
  }

  /**
   * Get product by SKU
   * MIGRATED: Now uses R1 Product Catalog contract
   */
  async getProductBySku(tenantId: string, sku: string): Promise<RetailProduct | null> {
    const product = await this.productCatalogEngine.getProductBySku(tenantId, sku);
    
    if (!product) return null;
    return this.mapToRetailProduct(product);
  }

  /**
   * Map domain Product to RetailProduct (DB type)
   * Preserves bella-retail-store's existing type interface
   */
  private mapToRetailProduct(product: any): RetailProduct {
    return {
      id: product.id,
      tenant_id: product.tenantId,
      sku: product.sku,
      name: product.name,
      description: product.description || null,
      category: product.category,
      base_price: product.basePrice,
      cost_price: product.costPrice || null,
      track_inventory: product.trackInventory ?? true,
      current_stock: product.currentStock ?? 0,
      reorder_point: product.reorderPoint || null,
      status: product.status,
      created_by: product.createdBy || null,
      updated_by: product.updatedBy || null,
      created_at: product.createdAt,
      updated_at: product.updatedAt,
    };
  }
}
