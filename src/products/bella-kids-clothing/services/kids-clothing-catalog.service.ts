/**
 * Kids Clothing Catalog Service
 * 
 * Product-specific business logic for kids fashion retail
 * Integrates R1 (Product Catalog) + R3 (Product Variants)
 * 
 * @module products/bella-kids-clothing
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { ProductCatalogEngine } from '../../../platform/retail/engines/product-catalog/product-catalog.engine';
import { SupabaseProductCatalogRepository } from '../../../platform/retail/engines/product-catalog/supabase-product-catalog.repository';
import { ProductVariantEngine } from '../../../platform/retail/engines/product-variant/product-variant.engine';
import { SupabaseProductVariantRepository } from '../../../platform/retail/engines/product-variant/supabase-product-variant.repository';
import type { Product } from '../../../platform/retail/contracts/product-catalog.contract';
import type { ProductVariant } from '../../../platform/retail/contracts/product-variant.contract';

/**
 * Kids Size Standard
 */
export type KidsSize = 
  | '0-3M' | '3-6M' | '6-9M' | '9-12M' // Infants
  | '12-18M' | '18-24M' // Toddlers
  | '2T' | '3T' | '4T' | '5T' // Toddler sizes
  | '6' | '7' | '8' | '10' | '12' | '14'; // Kids sizes

/**
 * Season
 */
export type Season = 'Spring' | 'Summer' | 'Fall' | 'Winter';

/**
 * Product Category
 */
export type KidsCategory = 
  | 'Tops'
  | 'Bottoms'
  | 'Dresses'
  | 'Outerwear'
  | 'Sleepwear'
  | 'Accessories';

/**
 * Kids Product Creation Request
 */
export interface CreateKidsProductRequest {
  tenantId: string;
  sku: string;
  name: string;
  description?: string;
  basePrice: number;
  category: KidsCategory;
  season?: Season;
  sizes: KidsSize[];
  colors: string[];
  initialStockPerVariant?: number;
}

/**
 * Kids Clothing Catalog Service
 * 
 * Orchestrates R1 (parent products) and R3 (size/color variants)
 */
export class KidsClothingCatalogService {
  private productCatalogEngine: ProductCatalogEngine;
  private productVariantEngine: ProductVariantEngine;

  constructor(supabase: SupabaseClient) {
    const productRepo = new SupabaseProductCatalogRepository(supabase);
    const variantRepo = new SupabaseProductVariantRepository(supabase);
    
    this.productCatalogEngine = new ProductCatalogEngine(productRepo);
    this.productVariantEngine = new ProductVariantEngine(variantRepo);
  }

  /**
   * Create a kids product with size/color variants
   * 
   * Creates:
   * 1. Parent product (R1)
   * 2. All size/color combination variants (R3)
   */
  async createProductWithVariants(
    request: CreateKidsProductRequest
  ): Promise<{
    product: Product;
    variants: ProductVariant[];
  }> {
    // 1. Create parent product
    const product = await this.productCatalogEngine.createProduct({
      tenantId: request.tenantId,
      sku: request.sku,
      name: request.name,
      description: request.description,
      basePrice: request.basePrice,
      category: request.category
    });

    // 2. Create variants for all size/color combinations
    const variants: ProductVariant[] = [];
    for (const size of request.sizes) {
      for (const color of request.colors) {
        const variantSku = `${request.sku}-${size}-${color}`.toUpperCase().replace(/\s+/g, '-');
        
        const variant = await this.productVariantEngine.createVariant({
          tenantId: request.tenantId,
          productId: product.id,
          variantSku,
          variantAttributes: { size, color },
          initialStock: request.initialStockPerVariant || 0
        });
        
        variants.push(variant);
      }
    }

    return { product, variants };
  }

  /**
   * Get product with all variants
   */
  async getProductWithVariants(
    tenantId: string,
    productId: string
  ): Promise<{
    product: Product | null;
    variants: ProductVariant[];
  }> {
    const product = await this.productCatalogEngine.getProductById(tenantId, productId);
    const variants = await this.productVariantEngine.getVariantsByProduct(tenantId, productId);

    return { product, variants };
  }

  /**
   * Get variant by SKU
   */
  async getVariantBySku(
    tenantId: string,
    variantSku: string
  ): Promise<ProductVariant | null> {
    return this.productVariantEngine.getVariantBySku(tenantId, variantSku);
  }

  /**
   * Update variant stock
   */
  async updateVariantStock(
    tenantId: string,
    variantId: string,
    newStock: number
  ): Promise<ProductVariant> {
    return this.productVariantEngine.updateVariantStock({
      tenantId,
      variantId,
      newStock
    });
  }
}
