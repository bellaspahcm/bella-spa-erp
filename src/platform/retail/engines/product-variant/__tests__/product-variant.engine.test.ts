/**
 * Product Variant Engine Tests (R3)
 * Tests for R3 Product Variant capability
 * 
 * @module platform/retail/engines/product-variant/__tests__
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ProductVariantEngine } from '../product-variant.engine';
import type { IProductVariantRepository } from '../product-variant-repository.interface';
import type {
  ProductVariant,
  CreateVariantRequest,
  UpdateVariantStockRequest,
} from '../../../contracts/product-variant.contract';

/**
 * Mock Repository for Testing
 */
class MockVariantRepository implements IProductVariantRepository {
  private variants: Map<string, ProductVariant> = new Map();
  private skuIndex: Map<string, string> = new Map(); // sku -> variantId
  private nextId = 1;

  async create(variant: Omit<ProductVariant, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProductVariant> {
    const id = `var-${this.nextId++}`;
    const now = new Date().toISOString();
    
    const created: ProductVariant = {
      ...variant,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.variants.set(id, created);
    this.skuIndex.set(`${variant.tenantId}:${variant.variantSku}`, id);
    
    return created;
  }

  async update(variant: ProductVariant): Promise<ProductVariant> {
    const existing = this.variants.get(variant.id);
    if (!existing) {
      throw new Error('Variant not found');
    }

    const updated = {
      ...variant,
      updatedAt: new Date().toISOString(),
    };

    this.variants.set(variant.id, updated);
    return updated;
  }

  async findById(tenantId: string, variantId: string): Promise<ProductVariant | null> {
    const variant = this.variants.get(variantId);
    if (!variant || variant.tenantId !== tenantId) {
      return null;
    }
    return variant;
  }

  async findBySku(tenantId: string, variantSku: string): Promise<ProductVariant | null> {
    const variantId = this.skuIndex.get(`${tenantId}:${variantSku}`);
    if (!variantId) return null;

    return this.findById(tenantId, variantId);
  }

  async findByProduct(
    tenantId: string,
    productId: string,
    includeDiscontinued = false
  ): Promise<ProductVariant[]> {
    return Array.from(this.variants.values()).filter(
      v =>
        v.tenantId === tenantId &&
        v.productId === productId &&
        (includeDiscontinued || v.status === 'ACTIVE')
    );
  }

  async getTotalStock(tenantId: string, productId: string): Promise<number> {
    const variants = await this.findByProduct(tenantId, productId, false);
    return variants.reduce((total, v) => total + v.currentStock, 0);
  }
}

describe('ProductVariantEngine', () => {
  let engine: ProductVariantEngine;
  let repository: MockVariantRepository;

  beforeEach(() => {
    repository = new MockVariantRepository();
    engine = new ProductVariantEngine(repository);
  });

  describe('createVariant', () => {
    it('should create variant with valid attributes', async () => {
      const request: CreateVariantRequest = {
        tenantId: 'tenant-1',
        productId: 'prod-1',
        variantSku: 'SHIRT-RED-M',
        variantAttributes: { color: 'Red', size: 'M' },
        initialStock: 100,
      };

      const variant = await engine.createVariant(request);

      expect(variant.id).toBeDefined();
      expect(variant.tenantId).toBe('tenant-1');
      expect(variant.productId).toBe('prod-1');
      expect(variant.variantSku).toBe('SHIRT-RED-M');
      expect(variant.variantAttributes).toEqual({ color: 'Red', size: 'M' });
      expect(variant.currentStock).toBe(100);
      expect(variant.status).toBe('ACTIVE');
    });

    it('should auto-generate SKU if not provided', async () => {
      const request: CreateVariantRequest = {
        tenantId: 'tenant-1',
        productId: 'prod-1',
        variantAttributes: { color: 'Blue', size: 'L' },
        initialStock: 50,
      };

      const variant = await engine.createVariant(request);

      expect(variant.variantSku).toBe('BLUE-L');
    });

    it('should reject empty attributes', async () => {
      const request: CreateVariantRequest = {
        tenantId: 'tenant-1',
        productId: 'prod-1',
        variantAttributes: {},
        initialStock: 100,
      };

      await expect(engine.createVariant(request)).rejects.toThrow(
        'variant_attributes cannot be empty'
      );
    });

    it('should reject duplicate SKU', async () => {
      const request: CreateVariantRequest = {
        tenantId: 'tenant-1',
        productId: 'prod-1',
        variantSku: 'SHIRT-RED-M',
        variantAttributes: { color: 'Red', size: 'M' },
        initialStock: 100,
      };

      await engine.createVariant(request);

      await expect(engine.createVariant(request)).rejects.toThrow(
        "variant_sku 'SHIRT-RED-M' already exists"
      );
    });
  });

  describe('updateVariantStock', () => {
    it('should update variant stock', async () => {
      const createReq: CreateVariantRequest = {
        tenantId: 'tenant-1',
        productId: 'prod-1',
        variantSku: 'SHIRT-RED-M',
        variantAttributes: { color: 'Red', size: 'M' },
        initialStock: 100,
      };

      const created = await engine.createVariant(createReq);

      const updateReq: UpdateVariantStockRequest = {
        tenantId: 'tenant-1',
        variantId: created.id,
        newStock: 50,
      };

      const updated = await engine.updateVariantStock(updateReq);

      expect(updated.currentStock).toBe(50);
    });

    it('should reject negative stock', async () => {
      const createReq: CreateVariantRequest = {
        tenantId: 'tenant-1',
        productId: 'prod-1',
        variantSku: 'SHIRT-RED-M',
        variantAttributes: { color: 'Red', size: 'M' },
        initialStock: 100,
      };

      const created = await engine.createVariant(createReq);

      const updateReq: UpdateVariantStockRequest = {
        tenantId: 'tenant-1',
        variantId: created.id,
        newStock: -10,
      };

      await expect(engine.updateVariantStock(updateReq)).rejects.toThrow(
        'stock cannot be negative'
      );
    });

    it('should reject update for non-existent variant', async () => {
      const updateReq: UpdateVariantStockRequest = {
        tenantId: 'tenant-1',
        variantId: 'nonexistent',
        newStock: 50,
      };

      await expect(engine.updateVariantStock(updateReq)).rejects.toThrow(
        'variant does not exist'
      );
    });
  });

  describe('getVariantById', () => {
    it('should retrieve variant by ID', async () => {
      const createReq: CreateVariantRequest = {
        tenantId: 'tenant-1',
        productId: 'prod-1',
        variantSku: 'SHIRT-RED-M',
        variantAttributes: { color: 'Red', size: 'M' },
        initialStock: 100,
      };

      const created = await engine.createVariant(createReq);

      const retrieved = await engine.getVariantById('tenant-1', created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.variantSku).toBe('SHIRT-RED-M');
    });

    it('should return null for wrong tenant', async () => {
      const createReq: CreateVariantRequest = {
        tenantId: 'tenant-1',
        productId: 'prod-1',
        variantSku: 'SHIRT-RED-M',
        variantAttributes: { color: 'Red', size: 'M' },
        initialStock: 100,
      };

      const created = await engine.createVariant(createReq);

      const retrieved = await engine.getVariantById('tenant-2', created.id);

      expect(retrieved).toBeNull();
    });
  });

  describe('getVariantsByProduct', () => {
    it('should retrieve all variants for a product', async () => {
      await engine.createVariant({
        tenantId: 'tenant-1',
        productId: 'prod-1',
        variantSku: 'SHIRT-RED-S',
        variantAttributes: { color: 'Red', size: 'S' },
        initialStock: 50,
      });

      await engine.createVariant({
        tenantId: 'tenant-1',
        productId: 'prod-1',
        variantSku: 'SHIRT-RED-M',
        variantAttributes: { color: 'Red', size: 'M' },
        initialStock: 75,
      });

      await engine.createVariant({
        tenantId: 'tenant-1',
        productId: 'prod-2',
        variantSku: 'PANTS-BLUE-M',
        variantAttributes: { color: 'Blue', size: 'M' },
        initialStock: 100,
      });

      const variants = await engine.getVariantsByProduct('tenant-1', 'prod-1');

      expect(variants).toHaveLength(2);
      expect(variants.every(v => v.productId === 'prod-1')).toBe(true);
    });
  });

  describe('getTotalVariantStock', () => {
    it('should sum stock across all variants', async () => {
      await engine.createVariant({
        tenantId: 'tenant-1',
        productId: 'prod-1',
        variantSku: 'SHIRT-RED-S',
        variantAttributes: { color: 'Red', size: 'S' },
        initialStock: 50,
      });

      await engine.createVariant({
        tenantId: 'tenant-1',
        productId: 'prod-1',
        variantSku: 'SHIRT-RED-M',
        variantAttributes: { color: 'Red', size: 'M' },
        initialStock: 75,
      });

      await engine.createVariant({
        tenantId: 'tenant-1',
        productId: 'prod-1',
        variantSku: 'SHIRT-RED-L',
        variantAttributes: { color: 'Red', size: 'L' },
        initialStock: 100,
      });

      const total = await engine.getTotalVariantStock('tenant-1', 'prod-1');

      expect(total).toBe(225);
    });

    it('should return 0 for product with no variants', async () => {
      const total = await engine.getTotalVariantStock('tenant-1', 'prod-nonexistent');
      expect(total).toBe(0);
    });
  });
});
