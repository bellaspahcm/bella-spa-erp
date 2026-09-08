/**
 * Fresh Food Catalog Service
 * 
 * Product-specific business logic for fresh food & grocery retail
 * Integrates R1 (Product Catalog) + R4 (Batch/Lot Tracking)
 * 
 * @module products/bella-fresh-food
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { ProductCatalogEngine } from '../../../platform/retail/engines/product-catalog/product-catalog.engine';
import { SupabaseProductCatalogRepository } from '../../../platform/retail/engines/product-catalog/supabase-product-catalog.repository';
import { BatchLotEngine } from '../../../platform/retail/engines/batch-lot-tracking/batch-lot.engine';
import { SupabaseBatchLotRepository } from '../../../platform/retail/engines/batch-lot-tracking/supabase-batch-lot.repository';
import type { Product } from '../../../platform/retail/contracts/product-catalog.contract';
import type { BatchLot } from '../../../platform/retail/contracts/batch-lot-tracking.contract';

/**
 * Product Category (Fresh Food specific)
 */
export type FreshFoodCategory = 
  | 'Dairy'
  | 'Produce'
  | 'Meat'
  | 'Bakery'
  | 'Seafood'
  | 'Deli'
  | 'Frozen';

/**
 * Perishable Product Creation Request
 */
export interface CreatePerishableProductRequest {
  tenantId: string;
  sku: string;
  name: string;
  description?: string;
  basePrice: number;
  category: FreshFoodCategory;
  shelfLifeDays: number; // Expected shelf life
  unit: string; // 'kg', 'L', 'pcs', etc.
}

/**
 * Batch Receipt Request
 */
export interface ReceiveBatchRequest {
  tenantId: string;
  productId: string;
  batchNumber: string;
  lotNumber?: string;
  manufacturedDate?: string; // ISO date
  expiryDate: string; // ISO date (required)
  quantity: number;
  supplierId?: string;
  notes?: string;
}

/**
 * Fresh Food Catalog Service
 * 
 * Orchestrates R1 (parent products) and R4 (batch/expiry tracking)
 */
export class FreshFoodCatalogService {
  private productCatalogEngine: ProductCatalogEngine;
  private batchLotEngine: BatchLotEngine;

  constructor(supabase: SupabaseClient) {
    const productRepo = new SupabaseProductCatalogRepository(supabase);
    const batchRepo = new SupabaseBatchLotRepository(supabase);
    
    this.productCatalogEngine = new ProductCatalogEngine(productRepo);
    this.batchLotEngine = new BatchLotEngine(batchRepo);
  }

  /**
   * Create a perishable product
   */
  async createProduct(request: CreatePerishableProductRequest): Promise<Product> {
    return this.productCatalogEngine.createProduct({
      tenantId: request.tenantId,
      sku: request.sku,
      name: request.name,
      description: request.description,
      basePrice: request.basePrice,
      category: request.category
    });
  }

  /**
   * Receive new batch of perishable product
   * 
   * Creates batch record with expiry tracking
   */
  async receiveBatch(request: ReceiveBatchRequest): Promise<BatchLot> {
    // Validate expiry date is in future
    const expiryDate = new Date(request.expiryDate);
    const now = new Date();
    
    if (expiryDate <= now) {
      throw new Error('INVALID_EXPIRY_DATE: Expiry date must be in the future');
    }

    // Create batch
    return this.batchLotEngine.createBatch({
      tenantId: request.tenantId,
      productId: request.productId,
      batchNumber: request.batchNumber,
      lotNumber: request.lotNumber,
      manufacturedDate: request.manufacturedDate,
      expiryDate: request.expiryDate,
      initialStock: request.quantity,
      unit: 'units', // Default unit
      supplierId: request.supplierId,
      notes: request.notes
    });
  }

  /**
   * Get next batch to use (FEFO - First Expire, First Out)
   * 
   * Returns batch that expires soonest with available stock
   */
  async getNextBatchForSale(
    tenantId: string,
    productId: string,
    requiredQuantity: number
  ): Promise<BatchLot | null> {
    return this.batchLotEngine.suggestBatchForAllocation(
      tenantId,
      productId,
      requiredQuantity
    );
  }

  /**
   * Get all batches for a product (FEFO order)
   */
  async getBatchesForProduct(
    tenantId: string,
    productId: string
  ): Promise<BatchLot[]> {
    return this.batchLotEngine.getBatchesForProductFEFO(tenantId, productId);
  }

  /**
   * Get product with all batches
   */
  async getProductWithBatches(
    tenantId: string,
    productId: string
  ): Promise<{
    product: Product | null;
    batches: BatchLot[];
    totalStock: number;
  }> {
    const product = await this.productCatalogEngine.getProductById(tenantId, productId);
    const batches = await this.getBatchesForProduct(tenantId, productId);
    const totalStock = batches.reduce((sum, b) => sum + b.currentStock, 0);

    return { product, batches, totalStock };
  }

  /**
   * Sell from batch (reduce stock)
   */
  async sellFromBatch(
    tenantId: string,
    batchId: string,
    quantity: number
  ): Promise<BatchLot> {
    return this.batchLotEngine.reduceStock({
      tenantId,
      batchId,
      quantity
    });
  }
}
