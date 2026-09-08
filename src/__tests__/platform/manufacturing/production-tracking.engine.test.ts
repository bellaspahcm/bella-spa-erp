/**
 * MANUFACTURING OS - PRODUCTION TRACKING ENGINE TESTS
 * 
 * Unit tests for M2 Production Tracking Engine.
 * Verifies production recording operations + metrics.
 */

import { ProductionTrackingEngine } from '@/platform/manufacturing/engines/production-tracking/production-tracking.engine';
import type { IProductionTrackingRepository } from '@/platform/manufacturing/engines/production-tracking/production-tracking-repository.interface';
import type { IWorkOrderRepository } from '@/platform/manufacturing/engines/work-order/work-order-repository.interface';
import type { ProductionRecord } from '@/platform/manufacturing/contracts/production-tracking.contract';
import type { WorkOrder } from '@/platform/manufacturing/contracts/work-order.contract';

describe('ProductionTrackingEngine', () => {
  let engine: ProductionTrackingEngine;
  let mockProductionRepo: jest.Mocked<IProductionTrackingRepository>;
  let mockWorkOrderRepo: jest.Mocked<IWorkOrderRepository>;

  beforeEach(() => {
    mockProductionRepo = {
      create: jest.fn(),
      findByWorkOrder: jest.fn(),
    };

    mockWorkOrderRepo = {
      create: jest.fn(),
      updateStatus: jest.fn(),
      findById: jest.fn(),
      findByOrderNumber: jest.fn(),
    };

    engine = new ProductionTrackingEngine(mockProductionRepo, mockWorkOrderRepo);
  });

  describe('recordProduction', () => {
    it('should record production for IN_PROGRESS work order', async () => {
      const mockWO: WorkOrder = {
        id: 'wo-001',
        tenantId: 'tenant-a',
        orderNumber: 'WO-001',
        productId: 'prod-001',
        quantity: 100,
        priority: 'NORMAL',
        status: 'IN_PROGRESS',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockRecord: ProductionRecord = {
        id: 'prod-rec-001',
        tenantId: 'tenant-a',
        workOrderId: 'wo-001',
        quantityProduced: 50,
        quantityRejected: 2,
        status: 'COMPLETED',
        producedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockWorkOrderRepo.findById.mockResolvedValue(mockWO);
      mockProductionRepo.create.mockResolvedValue(mockRecord);

      const result = await engine.recordProduction({
        tenantId: 'tenant-a',
        workOrderId: 'wo-001',
        quantityProduced: 50,
        quantityRejected: 2,
      });

      expect(result.quantityProduced).toBe(50);
      expect(result.quantityRejected).toBe(2);
      expect(mockProductionRepo.create).toHaveBeenCalled();
    });

    it('should enforce tenant isolation', async () => {
      await expect(
        engine.recordProduction({
          tenantId: '',
          workOrderId: 'wo-001',
          quantityProduced: 10,
        })
      ).rejects.toThrow('TENANT_ISOLATION_VIOLATION');
    });

    it('should enforce quantity produced non-negativity', async () => {
      await expect(
        engine.recordProduction({
          tenantId: 'tenant-a',
          workOrderId: 'wo-001',
          quantityProduced: -5,
        })
      ).rejects.toThrow('INVALID_QUANTITY');
    });

    it('should enforce quantity rejected non-negativity', async () => {
      await expect(
        engine.recordProduction({
          tenantId: 'tenant-a',
          workOrderId: 'wo-001',
          quantityProduced: 10,
          quantityRejected: -2,
        })
      ).rejects.toThrow('INVALID_QUANTITY');
    });

    it('should reject if work order not found', async () => {
      mockWorkOrderRepo.findById.mockResolvedValue(null);

      await expect(
        engine.recordProduction({
          tenantId: 'tenant-a',
          workOrderId: 'nonexistent',
          quantityProduced: 10,
        })
      ).rejects.toThrow('WORK_ORDER_NOT_FOUND');
    });

    it('should reject if work order not IN_PROGRESS', async () => {
      const scheduledWO: WorkOrder = {
        id: 'wo-001',
        tenantId: 'tenant-a',
        orderNumber: 'WO-001',
        productId: 'prod-001',
        quantity: 100,
        priority: 'NORMAL',
        status: 'SCHEDULED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockWorkOrderRepo.findById.mockResolvedValue(scheduledWO);

      await expect(
        engine.recordProduction({
          tenantId: 'tenant-a',
          workOrderId: 'wo-001',
          quantityProduced: 10,
        })
      ).rejects.toThrow('WORK_ORDER_NOT_IN_PROGRESS');
    });

    it('should default quantityRejected to 0', async () => {
      const mockWO: WorkOrder = {
        id: 'wo-001',
        tenantId: 'tenant-a',
        orderNumber: 'WO-001',
        productId: 'prod-001',
        quantity: 100,
        priority: 'NORMAL',
        status: 'IN_PROGRESS',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockRecord: ProductionRecord = {
        id: 'prod-rec-001',
        tenantId: 'tenant-a',
        workOrderId: 'wo-001',
        quantityProduced: 25,
        quantityRejected: 0,
        status: 'COMPLETED',
        producedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockWorkOrderRepo.findById.mockResolvedValue(mockWO);
      mockProductionRepo.create.mockResolvedValue(mockRecord);

      const result = await engine.recordProduction({
        tenantId: 'tenant-a',
        workOrderId: 'wo-001',
        quantityProduced: 25,
        // quantityRejected not provided
      });

      expect(result.quantityRejected).toBe(0);
    });
  });

  describe('getProductionHistory', () => {
    it('should return production records ordered by date', async () => {
      const mockRecords: ProductionRecord[] = [
        {
          id: 'rec-002',
          tenantId: 'tenant-a',
          workOrderId: 'wo-001',
          quantityProduced: 30,
          quantityRejected: 1,
          status: 'COMPLETED',
          producedAt: '2024-01-02T10:00:00Z',
          createdAt: '2024-01-02T10:00:00Z',
          updatedAt: '2024-01-02T10:00:00Z',
        },
        {
          id: 'rec-001',
          tenantId: 'tenant-a',
          workOrderId: 'wo-001',
          quantityProduced: 25,
          quantityRejected: 0,
          status: 'COMPLETED',
          producedAt: '2024-01-01T10:00:00Z',
          createdAt: '2024-01-01T10:00:00Z',
          updatedAt: '2024-01-01T10:00:00Z',
        },
      ];

      mockProductionRepo.findByWorkOrder.mockResolvedValue(mockRecords);

      const result = await engine.getProductionHistory('tenant-a', 'wo-001');

      expect(result.length).toBe(2);
      expect(result[0].id).toBe('rec-002'); // Most recent first
    });

    it('should return empty array when no records', async () => {
      mockProductionRepo.findByWorkOrder.mockResolvedValue([]);

      const result = await engine.getProductionHistory('tenant-a', 'wo-001');

      expect(result).toEqual([]);
    });

    it('should enforce tenant isolation', async () => {
      await expect(
        engine.getProductionHistory('', 'wo-001')
      ).rejects.toThrow('TENANT_ISOLATION_VIOLATION');
    });
  });

  describe('getProductionSummary', () => {
    it('should calculate production summary correctly', async () => {
      const mockWO: WorkOrder = {
        id: 'wo-001',
        tenantId: 'tenant-a',
        orderNumber: 'WO-001',
        productId: 'prod-001',
        quantity: 100,
        priority: 'NORMAL',
        status: 'IN_PROGRESS',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockRecords: ProductionRecord[] = [
        {
          id: 'rec-001',
          tenantId: 'tenant-a',
          workOrderId: 'wo-001',
          quantityProduced: 40,
          quantityRejected: 2,
          status: 'COMPLETED',
          producedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'rec-002',
          tenantId: 'tenant-a',
          workOrderId: 'wo-001',
          quantityProduced: 35,
          quantityRejected: 3,
          status: 'COMPLETED',
          producedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      mockWorkOrderRepo.findById.mockResolvedValue(mockWO);
      mockProductionRepo.findByWorkOrder.mockResolvedValue(mockRecords);

      const result = await engine.getProductionSummary('tenant-a', 'wo-001', 100);

      expect(result.totalProduced).toBe(75); // 40 + 35
      expect(result.totalRejected).toBe(5); // 2 + 3
      expect(result.totalRecords).toBe(2);
      expect(result.completionPercentage).toBe(75); // (75 / 100) * 100
      expect(result.qualityRate).toBe(94); // (75 / (75 + 5)) * 100 = 93.75 → 94
    });

    it('should handle zero planned quantity', async () => {
      const mockWO: WorkOrder = {
        id: 'wo-001',
        tenantId: 'tenant-a',
        orderNumber: 'WO-001',
        productId: 'prod-001',
        quantity: 0,
        priority: 'NORMAL',
        status: 'DRAFT',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockWorkOrderRepo.findById.mockResolvedValue(mockWO);
      mockProductionRepo.findByWorkOrder.mockResolvedValue([]);

      const result = await engine.getProductionSummary('tenant-a', 'wo-001', 0);

      expect(result.completionPercentage).toBe(0);
    });

    it('should handle no production records (100% quality)', async () => {
      const mockWO: WorkOrder = {
        id: 'wo-001',
        tenantId: 'tenant-a',
        orderNumber: 'WO-001',
        productId: 'prod-001',
        quantity: 100,
        priority: 'NORMAL',
        status: 'SCHEDULED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockWorkOrderRepo.findById.mockResolvedValue(mockWO);
      mockProductionRepo.findByWorkOrder.mockResolvedValue([]);

      const result = await engine.getProductionSummary('tenant-a', 'wo-001', 100);

      expect(result.totalProduced).toBe(0);
      expect(result.totalRejected).toBe(0);
      expect(result.qualityRate).toBe(100); // No production = 100% quality (default)
    });

    it('should enforce tenant isolation', async () => {
      await expect(
        engine.getProductionSummary('', 'wo-001', 100)
      ).rejects.toThrow('TENANT_ISOLATION_VIOLATION');
    });

    it('should throw if work order not found', async () => {
      mockWorkOrderRepo.findById.mockResolvedValue(null);

      await expect(
        engine.getProductionSummary('tenant-a', 'nonexistent', 100)
      ).rejects.toThrow('WORK_ORDER_NOT_FOUND');
    });
  });
});
