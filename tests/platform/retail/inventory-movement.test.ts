/**
 * InventoryMovement Domain Tests
 * 
 * Behavioral verification of InventoryMovement entity correctness
 */

import { describe, it, expect } from 'vitest';
import { InventoryMovement } from '../../../src/platform/retail/domain/inventory-movement';

describe('InventoryMovement', () => {
  const tenantId = 'test-tenant-123';
  const productId = 'product-456';

  describe('create', () => {
    it('should create inventory increase movement', () => {
      const movement = InventoryMovement.create({
        tenantId,
        productId,
        movementType: 'RESTOCK',
        quantityChange: 100,
        previousStock: 50,
      });

      expect(movement.tenantId).toBe(tenantId);
      expect(movement.productId).toBe(productId);
      expect(movement.movementType).toBe('RESTOCK');
      expect(movement.quantityChange).toBe(100);
      expect(movement.previousStock).toBe(50);
      expect(movement.newStock).toBe(150); // 50 + 100
      expect(movement.isIncrease).toBe(true);
      expect(movement.isDecrease).toBe(false);
    });

    it('should create inventory decrease movement', () => {
      const movement = InventoryMovement.create({
        tenantId,
        productId,
        movementType: 'SALE',
        quantityChange: -30,
        previousStock: 100,
      });

      expect(movement.quantityChange).toBe(-30);
      expect(movement.previousStock).toBe(100);
      expect(movement.newStock).toBe(70); // 100 - 30
      expect(movement.isIncrease).toBe(false);
      expect(movement.isDecrease).toBe(true);
    });

    it('should reject negative previous stock', () => {
      expect(() => InventoryMovement.create({
        tenantId,
        productId,
        movementType: 'RESTOCK',
        quantityChange: 50,
        previousStock: -10,
      })).toThrow('Previous stock cannot be negative');
    });

    it('should reject movement resulting in negative stock', () => {
      expect(() => InventoryMovement.create({
        tenantId,
        productId,
        movementType: 'SALE',
        quantityChange: -100,
        previousStock: 50,
      })).toThrow('New stock cannot be negative');
    });

    it('should create movement with reference', () => {
      const movement = InventoryMovement.create({
        tenantId,
        productId,
        movementType: 'SALE',
        quantityChange: -5,
        previousStock: 100,
        referenceType: 'SALE',
        referenceId: 'sale-789',
        reason: 'Sold to customer',
        performedBy: 'cashier-123',
      });

      expect(movement.referenceType).toBe('SALE');
      expect(movement.referenceId).toBe('sale-789');
      expect(movement.reason).toBe('Sold to customer');
      expect(movement.performedBy).toBe('cashier-123');
    });
  });

  describe('movement types', () => {
    it('should handle RESTOCK movements', () => {
      const movement = InventoryMovement.create({
        tenantId,
        productId,
        movementType: 'RESTOCK',
        quantityChange: 50,
        previousStock: 100,
      });

      expect(movement.newStock).toBe(150);
      expect(movement.isIncrease).toBe(true);
    });

    it('should handle SALE movements', () => {
      const movement = InventoryMovement.create({
        tenantId,
        productId,
        movementType: 'SALE',
        quantityChange: -10,
        previousStock: 100,
      });

      expect(movement.newStock).toBe(90);
      expect(movement.isDecrease).toBe(true);
    });

    it('should handle ADJUSTMENT movements (positive)', () => {
      const movement = InventoryMovement.create({
        tenantId,
        productId,
        movementType: 'ADJUSTMENT',
        quantityChange: 5,
        previousStock: 100,
        reason: 'Found extra stock',
      });

      expect(movement.newStock).toBe(105);
    });

    it('should handle ADJUSTMENT movements (negative)', () => {
      const movement = InventoryMovement.create({
        tenantId,
        productId,
        movementType: 'ADJUSTMENT',
        quantityChange: -3,
        previousStock: 100,
        reason: 'Missing stock',
      });

      expect(movement.newStock).toBe(97);
    });

    it('should handle RETURN movements', () => {
      const movement = InventoryMovement.create({
        tenantId,
        productId,
        movementType: 'RETURN',
        quantityChange: 2,
        previousStock: 100,
      });

      expect(movement.newStock).toBe(102);
      expect(movement.isIncrease).toBe(true);
    });

    it('should handle DAMAGE movements', () => {
      const movement = InventoryMovement.create({
        tenantId,
        productId,
        movementType: 'DAMAGE',
        quantityChange: -7,
        previousStock: 100,
        reason: 'Product damaged',
      });

      expect(movement.newStock).toBe(93);
      expect(movement.isDecrease).toBe(true);
    });

    it('should handle TRANSFER movements', () => {
      const movement = InventoryMovement.create({
        tenantId,
        productId,
        movementType: 'TRANSFER',
        quantityChange: -15,
        previousStock: 100,
        reason: 'Transferred to warehouse B',
      });

      expect(movement.newStock).toBe(85);
    });
  });

  describe('persistence round-trip', () => {
    it('should convert to and from persistence format correctly', () => {
      const movement = InventoryMovement.create({
        tenantId,
        productId,
        movementType: 'RESTOCK',
        quantityChange: 75,
        previousStock: 25,
        referenceType: 'PURCHASE_ORDER',
        referenceId: 'po-999',
        reason: 'Weekly restock',
        performedBy: 'manager-111',
      });

      const row = movement.toPersistence();
      const restored = InventoryMovement.fromPersistence(row);

      expect(restored.id).toBe(movement.id);
      expect(restored.tenantId).toBe(movement.tenantId);
      expect(restored.productId).toBe(movement.productId);
      expect(restored.movementType).toBe(movement.movementType);
      expect(restored.quantityChange).toBe(movement.quantityChange);
      expect(restored.previousStock).toBe(movement.previousStock);
      expect(restored.newStock).toBe(movement.newStock);
      expect(restored.referenceType).toBe(movement.referenceType);
      expect(restored.referenceId).toBe(movement.referenceId);
      expect(restored.reason).toBe(movement.reason);
      expect(restored.performedBy).toBe(movement.performedBy);
    });
  });
});
