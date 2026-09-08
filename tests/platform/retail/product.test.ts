/**
 * Retail Product Domain Tests
 * 
 * Behavioral verification of Product entity correctness
 */

import { describe, it, expect } from 'vitest';
import { Product } from '../../../src/platform/retail/domain/product';

describe('Product', () => {
  const tenantId = 'test-tenant-123';

  describe('create', () => {
    it('should create active product with valid data', () => {
      const product = Product.create({
        tenantId,
        sku: 'SKU-001',
        name: 'Test Product',
        description: 'A test product',
        category: 'Electronics',
        basePrice: 99.99,
        costPrice: 50.00,
        trackInventory: true,
        currentStock: 100,
        reorderPoint: 20,
        createdBy: 'user-123',
      });

      expect(product.tenantId).toBe(tenantId);
      expect(product.sku).toBe('SKU-001');
      expect(product.name).toBe('Test Product');
      expect(product.basePrice).toBe(99.99);
      expect(product.status).toBe('ACTIVE');
      expect(product.currentStock).toBe(100);
    });

    it('should reject negative base price', () => {
      expect(() => Product.create({
        tenantId,
        sku: 'SKU-002',
        name: 'Invalid Product',
        category: 'Test',
        basePrice: -10,
      })).toThrow('Base price cannot be negative');
    });

    it('should reject negative cost price', () => {
      expect(() => Product.create({
        tenantId,
        sku: 'SKU-003',
        name: 'Invalid Product',
        category: 'Test',
        basePrice: 100,
        costPrice: -50,
      })).toThrow('Cost price cannot be negative');
    });

    it('should reject negative stock', () => {
      expect(() => Product.create({
        tenantId,
        sku: 'SKU-004',
        name: 'Invalid Product',
        category: 'Test',
        basePrice: 100,
        currentStock: -10,
      })).toThrow('Stock cannot be negative');
    });

    it('should default track_inventory to true if not specified', () => {
      const product = Product.create({
        tenantId,
        sku: 'SKU-005',
        name: 'Default Inventory',
        category: 'Test',
        basePrice: 50,
      });

      expect(product.trackInventory).toBe(true);
    });
  });

  describe('update', () => {
    it('should update product fields', () => {
      const product = Product.create({
        tenantId,
        sku: 'SKU-010',
        name: 'Original Name',
        category: 'Original',
        basePrice: 100,
      });

      product.update({
        name: 'Updated Name',
        category: 'Updated',
        basePrice: 150,
      });

      expect(product.name).toBe('Updated Name');
      expect(product.category).toBe('Updated');
      expect(product.basePrice).toBe(150);
    });

    it('should reject negative base price on update', () => {
      const product = Product.create({
        tenantId,
        sku: 'SKU-011',
        name: 'Test',
        category: 'Test',
        basePrice: 100,
      });

      expect(() => product.update({ basePrice: -50 })).toThrow('Base price cannot be negative');
    });
  });

  describe('discontinue', () => {
    it('should set status to DISCONTINUED', () => {
      const product = Product.create({
        tenantId,
        sku: 'SKU-020',
        name: 'To Discontinue',
        category: 'Test',
        basePrice: 100,
      });

      product.discontinue('user-123');

      expect(product.status).toBe('DISCONTINUED');
      expect(product.updatedBy).toBe('user-123');
    });
  });

  describe('adjustStock', () => {
    it('should adjust stock for tracked inventory product', () => {
      const product = Product.create({
        tenantId,
        sku: 'SKU-030',
        name: 'Tracked Product',
        category: 'Test',
        basePrice: 100,
        trackInventory: true,
        currentStock: 100,
      });

      product.adjustStock(50, 'user-123');

      expect(product.currentStock).toBe(50);
    });

    it('should mark product OUT_OF_STOCK when stock reaches zero', () => {
      const product = Product.create({
        tenantId,
        sku: 'SKU-031',
        name: 'To Deplete',
        category: 'Test',
        basePrice: 100,
        trackInventory: true,
        currentStock: 100,
      });

      product.adjustStock(0);

      expect(product.currentStock).toBe(0);
      expect(product.status).toBe('OUT_OF_STOCK');
    });

    it('should reject stock adjustment for non-tracked inventory', () => {
      const product = Product.create({
        tenantId,
        sku: 'SKU-032',
        name: 'Non-Tracked',
        category: 'Test',
        basePrice: 100,
        trackInventory: false,
      });

      expect(() => product.adjustStock(50)).toThrow('Cannot adjust stock for non-tracked inventory product');
    });

    it('should reject negative stock', () => {
      const product = Product.create({
        tenantId,
        sku: 'SKU-033',
        name: 'Tracked',
        category: 'Test',
        basePrice: 100,
        trackInventory: true,
        currentStock: 100,
      });

      expect(() => product.adjustStock(-10)).toThrow('Stock cannot be negative');
    });
  });

  describe('needsReorder', () => {
    it('should return true when stock is at reorder point', () => {
      const product = Product.create({
        tenantId,
        sku: 'SKU-040',
        name: 'Low Stock',
        category: 'Test',
        basePrice: 100,
        trackInventory: true,
        currentStock: 20,
        reorderPoint: 20,
      });

      expect(product.needsReorder()).toBe(true);
    });

    it('should return false when stock is above reorder point', () => {
      const product = Product.create({
        tenantId,
        sku: 'SKU-041',
        name: 'Good Stock',
        category: 'Test',
        basePrice: 100,
        trackInventory: true,
        currentStock: 100,
        reorderPoint: 20,
      });

      expect(product.needsReorder()).toBe(false);
    });

    it('should return false for non-tracked inventory', () => {
      const product = Product.create({
        tenantId,
        sku: 'SKU-042',
        name: 'Non-Tracked',
        category: 'Test',
        basePrice: 100,
        trackInventory: false,
      });

      expect(product.needsReorder()).toBe(false);
    });
  });

  describe('reactivate', () => {
    it('should reactivate OUT_OF_STOCK product', () => {
      const product = Product.create({
        tenantId,
        sku: 'SKU-050',
        name: 'Out of Stock',
        category: 'Test',
        basePrice: 100,
        trackInventory: true,
        currentStock: 0,
      });

      product.markOutOfStock();
      product.reactivate('user-123');

      expect(product.status).toBe('ACTIVE');
    });

    it('should reject reactivation of discontinued product', () => {
      const product = Product.create({
        tenantId,
        sku: 'SKU-051',
        name: 'Discontinued',
        category: 'Test',
        basePrice: 100,
      });

      product.discontinue();

      expect(() => product.reactivate()).toThrow('Cannot reactivate discontinued product');
    });
  });

  describe('persistence round-trip', () => {
    it('should convert to and from persistence format correctly', () => {
      const product = Product.create({
        tenantId,
        sku: 'SKU-060',
        name: 'Persistence Test',
        description: 'Testing persistence',
        category: 'Test',
        basePrice: 99.99,
        costPrice: 50.00,
        trackInventory: true,
        currentStock: 100,
        reorderPoint: 20,
        createdBy: 'user-123',
      });

      const row = product.toPersistence();
      const restored = Product.fromPersistence(row);

      expect(restored.id).toBe(product.id);
      expect(restored.tenantId).toBe(product.tenantId);
      expect(restored.sku).toBe(product.sku);
      expect(restored.name).toBe(product.name);
      expect(restored.basePrice).toBe(product.basePrice);
      expect(restored.currentStock).toBe(product.currentStock);
      expect(restored.status).toBe(product.status);
    });
  });
});
