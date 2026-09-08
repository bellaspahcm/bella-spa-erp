/**
 * SaleItem Domain Tests
 * 
 * Behavioral verification of SaleItem entity correctness
 */

import { describe, it, expect } from 'vitest';
import { SaleItem } from '../../../src/platform/retail/domain/sale-item';

describe('SaleItem', () => {
  const tenantId = 'test-tenant-123';
  const saleId = 'sale-456';
  const productId = 'product-789';

  describe('create', () => {
    it('should create sale item with correct line total', () => {
      const item = SaleItem.create({
        tenantId,
        saleId,
        productId,
        quantity: 2,
        unitPrice: 50.00,
      });

      expect(item.tenantId).toBe(tenantId);
      expect(item.saleId).toBe(saleId);
      expect(item.productId).toBe(productId);
      expect(item.quantity).toBe(2);
      expect(item.unitPrice).toBe(50.00);
      expect(item.discountAmount).toBe(0);
      expect(item.lineTotal).toBe(100.00); // 2 * 50
    });

    it('should calculate line total with discount', () => {
      const item = SaleItem.create({
        tenantId,
        saleId,
        productId,
        quantity: 3,
        unitPrice: 100.00,
        discountAmount: 50.00,
      });

      expect(item.lineTotal).toBe(250.00); // (3 * 100) - 50
    });

    it('should reject zero quantity', () => {
      expect(() => SaleItem.create({
        tenantId,
        saleId,
        productId,
        quantity: 0,
        unitPrice: 50,
      })).toThrow('Quantity must be positive');
    });

    it('should reject negative quantity', () => {
      expect(() => SaleItem.create({
        tenantId,
        saleId,
        productId,
        quantity: -2,
        unitPrice: 50,
      })).toThrow('Quantity must be positive');
    });

    it('should reject negative unit price', () => {
      expect(() => SaleItem.create({
        tenantId,
        saleId,
        productId,
        quantity: 2,
        unitPrice: -50,
      })).toThrow('Unit price cannot be negative');
    });

    it('should reject negative discount', () => {
      expect(() => SaleItem.create({
        tenantId,
        saleId,
        productId,
        quantity: 2,
        unitPrice: 50,
        discountAmount: -10,
      })).toThrow('Discount amount cannot be negative');
    });

    it('should reject discount larger than line amount', () => {
      expect(() => SaleItem.create({
        tenantId,
        saleId,
        productId,
        quantity: 2,
        unitPrice: 50,
        discountAmount: 150, // Larger than 2 * 50
      })).toThrow('Line total cannot be negative');
    });
  });

  describe('updateQuantity', () => {
    it('should update quantity and recalculate line total', () => {
      const item = SaleItem.create({
        tenantId,
        saleId,
        productId,
        quantity: 2,
        unitPrice: 50,
        discountAmount: 10,
      });

      expect(item.lineTotal).toBe(90); // (2 * 50) - 10

      item.updateQuantity(5);

      expect(item.quantity).toBe(5);
      expect(item.lineTotal).toBe(240); // (5 * 50) - 10
    });

    it('should reject zero or negative quantity', () => {
      const item = SaleItem.create({
        tenantId,
        saleId,
        productId,
        quantity: 2,
        unitPrice: 50,
      });

      expect(() => item.updateQuantity(0)).toThrow('Quantity must be positive');
      expect(() => item.updateQuantity(-1)).toThrow('Quantity must be positive');
    });
  });

  describe('updateUnitPrice', () => {
    it('should update unit price and recalculate line total', () => {
      const item = SaleItem.create({
        tenantId,
        saleId,
        productId,
        quantity: 3,
        unitPrice: 50,
        discountAmount: 20,
      });

      expect(item.lineTotal).toBe(130); // (3 * 50) - 20

      item.updateUnitPrice(100);

      expect(item.unitPrice).toBe(100);
      expect(item.lineTotal).toBe(280); // (3 * 100) - 20
    });

    it('should reject negative unit price', () => {
      const item = SaleItem.create({
        tenantId,
        saleId,
        productId,
        quantity: 2,
        unitPrice: 50,
      });

      expect(() => item.updateUnitPrice(-10)).toThrow('Unit price cannot be negative');
    });
  });

  describe('applyDiscount', () => {
    it('should apply discount and recalculate line total', () => {
      const item = SaleItem.create({
        tenantId,
        saleId,
        productId,
        quantity: 4,
        unitPrice: 25,
      });

      expect(item.lineTotal).toBe(100); // 4 * 25

      item.applyDiscount(20);

      expect(item.discountAmount).toBe(20);
      expect(item.lineTotal).toBe(80); // (4 * 25) - 20
    });

    it('should reject negative discount', () => {
      const item = SaleItem.create({
        tenantId,
        saleId,
        productId,
        quantity: 2,
        unitPrice: 50,
      });

      expect(() => item.applyDiscount(-10)).toThrow('Discount amount cannot be negative');
    });

    it('should reject discount larger than line amount', () => {
      const item = SaleItem.create({
        tenantId,
        saleId,
        productId,
        quantity: 2,
        unitPrice: 50,
      });

      expect(() => item.applyDiscount(150)).toThrow('Line total cannot be negative');
    });
  });

  describe('persistence round-trip', () => {
    it('should convert to and from persistence format correctly', () => {
      const item = SaleItem.create({
        tenantId,
        saleId,
        productId,
        quantity: 3,
        unitPrice: 75.50,
        discountAmount: 25.00,
      });

      const row = item.toPersistence();
      const restored = SaleItem.fromPersistence(row);

      expect(restored.id).toBe(item.id);
      expect(restored.tenantId).toBe(item.tenantId);
      expect(restored.saleId).toBe(item.saleId);
      expect(restored.productId).toBe(item.productId);
      expect(restored.quantity).toBe(item.quantity);
      expect(restored.unitPrice).toBe(item.unitPrice);
      expect(restored.discountAmount).toBe(item.discountAmount);
      expect(restored.lineTotal).toBe(item.lineTotal);
    });
  });
});
