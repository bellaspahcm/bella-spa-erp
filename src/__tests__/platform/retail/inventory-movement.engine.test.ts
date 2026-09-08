/**
 * RETAIL OS - INVENTORY MOVEMENT ENGINE TESTS
 * 
 * Unit tests for R2 Inventory Movement Engine.
 * Verifies 4 operations + invariants.
 */

import { InventoryMovementEngine } from '@/platform/retail/engines/inventory-movement/inventory-movement.engine';
import type { IInventoryMovementRepository } from '@/platform/retail/engines/inventory-movement/inventory-movement-repository.interface';
import type { InventoryMovement, ReorderAlert } from '@/platform/retail/contracts/inventory-movement.contract';

describe('InventoryMovementEngine', () => {
  let engine: InventoryMovementEngine;
  let mockRepository: jest.Mocked<IInventoryMovementRepository>;

  beforeEach(() => {
    mockRepository = {
      createMovementAndUpdateStock: jest.fn(),
      findByProductId: jest.fn(),
      getProductStock: jest.fn(),
      findProductsNeedingReorder: jest.fn(),
    };

    engine = new InventoryMovementEngine(mockRepository);
  });

  describe('recordMovement', () => {
    it('should record positive movement (RESTOCK)', async () => {
      const request = {
        tenantId: 'tenant-1',
        productId: 'prod-1',
        movementType: 'RESTOCK' as const,
        quantityChange: 50,
        reason: 'Supplier delivery',
        userId: 'user-1',
      };

      const currentStock = 100;
      const expectedMovement: InventoryMovement = {
        id: expect.any(String),
        tenantId: 'tenant-1',
        productId: 'prod-1',
        movementType: 'RESTOCK',
        quantityChange: 50,
        previousStock: 100,
        newStock: 150,
        reason: 'Supplier delivery',
        performedBy: 'user-1',
        createdAt: expect.any(String),
      };

      mockRepository.getProductStock.mockResolvedValue(currentStock);
      mockRepository.createMovementAndUpdateStock.mockResolvedValue(expectedMovement);

      const result = await engine.recordMovement(request);

      expect(result).toMatchObject(expectedMovement);
      expect(mockRepository.createMovementAndUpdateStock).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 'prod-1',
          movementType: 'RESTOCK',
          quantityChange: 50,
          previousStock: 100,
          newStock: 150,
        }),
        150
      );
    });

    it('should record negative movement (SALE)', async () => {
      const request = {
        tenantId: 'tenant-1',
        productId: 'prod-1',
        movementType: 'SALE' as const,
        quantityChange: -10,
        referenceType: 'SALE' as const,
        referenceId: 'sale-123',
        userId: 'user-1',
      };

      const currentStock = 100;
      const expectedMovement: InventoryMovement = {
        id: expect.any(String),
        tenantId: 'tenant-1',
        productId: 'prod-1',
        movementType: 'SALE',
        quantityChange: -10,
        previousStock: 100,
        newStock: 90,
        referenceType: 'SALE',
        referenceId: 'sale-123',
        performedBy: 'user-1',
        createdAt: expect.any(String),
      };

      mockRepository.getProductStock.mockResolvedValue(currentStock);
      mockRepository.createMovementAndUpdateStock.mockResolvedValue(expectedMovement);

      const result = await engine.recordMovement(request);

      expect(result.newStock).toBe(90);
      expect(result.quantityChange).toBe(-10);
    });

    it('should prevent negative stock (invariant)', async () => {
      const request = {
        tenantId: 'tenant-1',
        productId: 'prod-1',
        movementType: 'SALE' as const,
        quantityChange: -150,
        userId: 'user-1',
      };

      const currentStock = 100;

      mockRepository.getProductStock.mockResolvedValue(currentStock);

      await expect(engine.recordMovement(request)).rejects.toThrow('INSUFFICIENT_STOCK');
      expect(mockRepository.createMovementAndUpdateStock).not.toHaveBeenCalled();
    });

    it('should allow reducing stock to exactly zero', async () => {
      const request = {
        tenantId: 'tenant-1',
        productId: 'prod-1',
        movementType: 'SALE' as const,
        quantityChange: -50,
        userId: 'user-1',
      };

      const currentStock = 50;
      const expectedMovement: InventoryMovement = {
        id: expect.any(String),
        tenantId: 'tenant-1',
        productId: 'prod-1',
        movementType: 'SALE',
        quantityChange: -50,
        previousStock: 50,
        newStock: 0,
        performedBy: 'user-1',
        createdAt: expect.any(String),
      };

      mockRepository.getProductStock.mockResolvedValue(currentStock);
      mockRepository.createMovementAndUpdateStock.mockResolvedValue(expectedMovement);

      const result = await engine.recordMovement(request);

      expect(result.newStock).toBe(0);
    });

    it('should enforce tenant isolation', async () => {
      const request = {
        tenantId: '',
        productId: 'prod-1',
        movementType: 'RESTOCK' as const,
        quantityChange: 10,
      };

      await expect(engine.recordMovement(request)).rejects.toThrow('TENANT_ISOLATION_VIOLATION');
    });

    it('should handle ADJUSTMENT movement type', async () => {
      const request = {
        tenantId: 'tenant-1',
        productId: 'prod-1',
        movementType: 'ADJUSTMENT' as const,
        quantityChange: -5,
        reason: 'Physical count correction',
        userId: 'user-1',
      };

      const currentStock = 100;
      const expectedMovement: InventoryMovement = {
        id: expect.any(String),
        tenantId: 'tenant-1',
        productId: 'prod-1',
        movementType: 'ADJUSTMENT',
        quantityChange: -5,
        previousStock: 100,
        newStock: 95,
        reason: 'Physical count correction',
        performedBy: 'user-1',
        createdAt: expect.any(String),
      };

      mockRepository.getProductStock.mockResolvedValue(currentStock);
      mockRepository.createMovementAndUpdateStock.mockResolvedValue(expectedMovement);

      const result = await engine.recordMovement(request);

      expect(result.movementType).toBe('ADJUSTMENT');
      expect(result.newStock).toBe(95);
    });

    it('should handle RETURN movement type', async () => {
      const request = {
        tenantId: 'tenant-1',
        productId: 'prod-1',
        movementType: 'RETURN' as const,
        quantityChange: 3,
        reason: 'Customer return',
        referenceType: 'SALE' as const,
        referenceId: 'sale-456',
        userId: 'user-1',
      };

      const currentStock = 50;
      const expectedMovement: InventoryMovement = {
        id: expect.any(String),
        tenantId: 'tenant-1',
        productId: 'prod-1',
        movementType: 'RETURN',
        quantityChange: 3,
        previousStock: 50,
        newStock: 53,
        reason: 'Customer return',
        referenceType: 'SALE',
        referenceId: 'sale-456',
        performedBy: 'user-1',
        createdAt: expect.any(String),
      };

      mockRepository.getProductStock.mockResolvedValue(currentStock);
      mockRepository.createMovementAndUpdateStock.mockResolvedValue(expectedMovement);

      const result = await engine.recordMovement(request);

      expect(result.movementType).toBe('RETURN');
      expect(result.quantityChange).toBe(3);
    });

    it('should handle DAMAGE movement type', async () => {
      const request = {
        tenantId: 'tenant-1',
        productId: 'prod-1',
        movementType: 'DAMAGE' as const,
        quantityChange: -2,
        reason: 'Damaged during inspection',
        userId: 'user-1',
      };

      const currentStock = 100;
      const expectedMovement: InventoryMovement = {
        id: expect.any(String),
        tenantId: 'tenant-1',
        productId: 'prod-1',
        movementType: 'DAMAGE',
        quantityChange: -2,
        previousStock: 100,
        newStock: 98,
        reason: 'Damaged during inspection',
        performedBy: 'user-1',
        createdAt: expect.any(String),
      };

      mockRepository.getProductStock.mockResolvedValue(currentStock);
      mockRepository.createMovementAndUpdateStock.mockResolvedValue(expectedMovement);

      const result = await engine.recordMovement(request);

      expect(result.movementType).toBe('DAMAGE');
    });
  });

  describe('getMovementHistory', () => {
    it('should return movement history ordered by date', async () => {
      const movements: InventoryMovement[] = [
        {
          id: 'mov-3',
          tenantId: 'tenant-1',
          productId: 'prod-1',
          movementType: 'SALE',
          quantityChange: -5,
          previousStock: 95,
          newStock: 90,
          createdAt: '2026-01-03T00:00:00Z',
        },
        {
          id: 'mov-2',
          tenantId: 'tenant-1',
          productId: 'prod-1',
          movementType: 'SALE',
          quantityChange: -5,
          previousStock: 100,
          newStock: 95,
          createdAt: '2026-01-02T00:00:00Z',
        },
        {
          id: 'mov-1',
          tenantId: 'tenant-1',
          productId: 'prod-1',
          movementType: 'RESTOCK',
          quantityChange: 100,
          previousStock: 0,
          newStock: 100,
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];

      mockRepository.findByProductId.mockResolvedValue(movements);

      const result = await engine.getMovementHistory('tenant-1', 'prod-1');

      expect(result).toEqual(movements);
      expect(mockRepository.findByProductId).toHaveBeenCalledWith('tenant-1', 'prod-1');
    });

    it('should return empty array when no movements', async () => {
      mockRepository.findByProductId.mockResolvedValue([]);

      const result = await engine.getMovementHistory('tenant-1', 'prod-1');

      expect(result).toEqual([]);
    });

    it('should enforce tenant isolation', async () => {
      await expect(engine.getMovementHistory('', 'prod-1')).rejects.toThrow('TENANT_ISOLATION_VIOLATION');
    });
  });

  describe('getCurrentStock', () => {
    it('should return current stock for product', async () => {
      mockRepository.getProductStock.mockResolvedValue(75);

      const result = await engine.getCurrentStock('tenant-1', 'prod-1');

      expect(result).toBe(75);
      expect(mockRepository.getProductStock).toHaveBeenCalledWith('tenant-1', 'prod-1');
    });

    it('should return zero for product with no stock', async () => {
      mockRepository.getProductStock.mockResolvedValue(0);

      const result = await engine.getCurrentStock('tenant-1', 'prod-1');

      expect(result).toBe(0);
    });

    it('should enforce tenant isolation', async () => {
      await expect(engine.getCurrentStock('', 'prod-1')).rejects.toThrow('TENANT_ISOLATION_VIOLATION');
    });
  });

  describe('detectReorderNeeds', () => {
    it('should return products needing reorder', async () => {
      const alerts: ReorderAlert[] = [
        {
          product: {
            id: 'prod-1',
            sku: 'SKU-001',
            name: 'Product 1',
          },
          currentStock: 5,
          reorderPoint: 10,
          deficit: 5,
        },
        {
          product: {
            id: 'prod-2',
            sku: 'SKU-002',
            name: 'Product 2',
          },
          currentStock: 0,
          reorderPoint: 5,
          deficit: 5,
        },
      ];

      mockRepository.findProductsNeedingReorder.mockResolvedValue(alerts);

      const result = await engine.detectReorderNeeds('tenant-1');

      expect(result).toEqual(alerts);
      expect(mockRepository.findProductsNeedingReorder).toHaveBeenCalledWith('tenant-1');
    });

    it('should return empty array when no reorders needed', async () => {
      mockRepository.findProductsNeedingReorder.mockResolvedValue([]);

      const result = await engine.detectReorderNeeds('tenant-1');

      expect(result).toEqual([]);
    });

    it('should enforce tenant isolation', async () => {
      await expect(engine.detectReorderNeeds('')).rejects.toThrow('TENANT_ISOLATION_VIOLATION');
    });
  });
});
