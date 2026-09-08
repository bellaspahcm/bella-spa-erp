/**
 * MANUFACTURING OS - WORK ORDER ENGINE TESTS
 * 
 * Unit tests for M1 Work Order Engine.
 * Verifies work order lifecycle operations + invariants.
 */

import { WorkOrderEngine } from '@/platform/manufacturing/engines/work-order/work-order.engine';
import type { IWorkOrderRepository } from '@/platform/manufacturing/engines/work-order/work-order-repository.interface';
import type { WorkOrder } from '@/platform/manufacturing/contracts/work-order.contract';

describe('WorkOrderEngine', () => {
  let engine: WorkOrderEngine;
  let mockRepository: jest.Mocked<IWorkOrderRepository>;

  beforeEach(() => {
    mockRepository = {
      create: jest.fn(),
      updateStatus: jest.fn(),
      findById: jest.fn(),
      findByOrderNumber: jest.fn(),
    };

    engine = new WorkOrderEngine(mockRepository);
  });

  describe('createWorkOrder', () => {
    it('should create work order with valid data', async () => {
      const mockCreated: WorkOrder = {
        id: 'wo-001',
        tenantId: 'tenant-a',
        orderNumber: 'WO-2024-001',
        productId: 'prod-001',
        quantity: 100,
        priority: 'NORMAL',
        status: 'DRAFT',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockRepository.create.mockResolvedValue(mockCreated);

      const result = await engine.createWorkOrder({
        tenantId: 'tenant-a',
        orderNumber: 'WO-2024-001',
        productId: 'prod-001',
        quantity: 100,
      });

      expect(result.id).toBe('wo-001');
      expect(result.status).toBe('DRAFT');
      expect(mockRepository.create).toHaveBeenCalled();
    });

    it('should enforce tenant isolation', async () => {
      await expect(
        engine.createWorkOrder({
          tenantId: '',
          orderNumber: 'WO-001',
          productId: 'prod-001',
          quantity: 100,
        })
      ).rejects.toThrow('TENANT_ISOLATION_VIOLATION');
    });

    it('should enforce quantity positivity', async () => {
      await expect(
        engine.createWorkOrder({
          tenantId: 'tenant-a',
          orderNumber: 'WO-001',
          productId: 'prod-001',
          quantity: 0,
        })
      ).rejects.toThrow('INVALID_QUANTITY');

      await expect(
        engine.createWorkOrder({
          tenantId: 'tenant-a',
          orderNumber: 'WO-001',
          productId: 'prod-001',
          quantity: -10,
        })
      ).rejects.toThrow('INVALID_QUANTITY');
    });

    it('should set default priority to NORMAL', async () => {
      const mockCreated: WorkOrder = {
        id: 'wo-001',
        tenantId: 'tenant-a',
        orderNumber: 'WO-001',
        productId: 'prod-001',
        quantity: 50,
        priority: 'NORMAL',
        status: 'DRAFT',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockRepository.create.mockResolvedValue(mockCreated);

      const result = await engine.createWorkOrder({
        tenantId: 'tenant-a',
        orderNumber: 'WO-001',
        productId: 'prod-001',
        quantity: 50,
      });

      expect(result.priority).toBe('NORMAL');
    });
  });

  describe('updateWorkOrderStatus', () => {
    it('should update status successfully', async () => {
      const currentWO: WorkOrder = {
        id: 'wo-001',
        tenantId: 'tenant-a',
        orderNumber: 'WO-001',
        productId: 'prod-001',
        quantity: 100,
        priority: 'NORMAL',
        status: 'DRAFT',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const updatedWO: WorkOrder = { ...currentWO, status: 'SCHEDULED' };

      mockRepository.findById.mockResolvedValue(currentWO);
      mockRepository.updateStatus.mockResolvedValue(updatedWO);

      const result = await engine.updateWorkOrderStatus({
        tenantId: 'tenant-a',
        workOrderId: 'wo-001',
        status: 'SCHEDULED',
      });

      expect(result.status).toBe('SCHEDULED');
    });

    it('should prevent transition from COMPLETED (finality)', async () => {
      const completedWO: WorkOrder = {
        id: 'wo-001',
        tenantId: 'tenant-a',
        orderNumber: 'WO-001',
        productId: 'prod-001',
        quantity: 100,
        priority: 'NORMAL',
        status: 'COMPLETED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockRepository.findById.mockResolvedValue(completedWO);

      await expect(
        engine.updateWorkOrderStatus({
          tenantId: 'tenant-a',
          workOrderId: 'wo-001',
          status: 'CANCELLED',
        })
      ).rejects.toThrow('WORK_ORDER_FINALITY_VIOLATION');
    });

    it('should prevent transition from CANCELLED (finality)', async () => {
      const cancelledWO: WorkOrder = {
        id: 'wo-001',
        tenantId: 'tenant-a',
        orderNumber: 'WO-001',
        productId: 'prod-001',
        quantity: 100,
        priority: 'NORMAL',
        status: 'CANCELLED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockRepository.findById.mockResolvedValue(cancelledWO);

      await expect(
        engine.updateWorkOrderStatus({
          tenantId: 'tenant-a',
          workOrderId: 'wo-001',
          status: 'SCHEDULED',
        })
      ).rejects.toThrow('WORK_ORDER_FINALITY_VIOLATION');
    });

    it('should prevent invalid status transitions', async () => {
      const draftWO: WorkOrder = {
        id: 'wo-001',
        tenantId: 'tenant-a',
        orderNumber: 'WO-001',
        productId: 'prod-001',
        quantity: 100,
        priority: 'NORMAL',
        status: 'DRAFT',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockRepository.findById.mockResolvedValue(draftWO);

      // DRAFT → IN_PROGRESS is invalid (must go through SCHEDULED)
      await expect(
        engine.updateWorkOrderStatus({
          tenantId: 'tenant-a',
          workOrderId: 'wo-001',
          status: 'IN_PROGRESS',
        })
      ).rejects.toThrow('INVALID_STATUS_TRANSITION');
    });

    it('should enforce tenant isolation', async () => {
      await expect(
        engine.updateWorkOrderStatus({
          tenantId: '',
          workOrderId: 'wo-001',
          status: 'SCHEDULED',
        })
      ).rejects.toThrow('TENANT_ISOLATION_VIOLATION');
    });

    it('should throw if work order not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        engine.updateWorkOrderStatus({
          tenantId: 'tenant-a',
          workOrderId: 'nonexistent',
          status: 'SCHEDULED',
        })
      ).rejects.toThrow('WORK_ORDER_NOT_FOUND');
    });
  });

  describe('startWorkOrder', () => {
    it('should start work order from SCHEDULED', async () => {
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

      const startedWO: WorkOrder = {
        ...scheduledWO,
        status: 'IN_PROGRESS',
        actualStartAt: new Date().toISOString(),
      };

      mockRepository.findById.mockResolvedValue(scheduledWO);
      mockRepository.updateStatus.mockResolvedValue(startedWO);

      const result = await engine.startWorkOrder({
        tenantId: 'tenant-a',
        workOrderId: 'wo-001',
      });

      expect(result.status).toBe('IN_PROGRESS');
      expect(result.actualStartAt).toBeDefined();
    });

    it('should resume work order from PAUSED', async () => {
      const pausedWO: WorkOrder = {
        id: 'wo-001',
        tenantId: 'tenant-a',
        orderNumber: 'WO-001',
        productId: 'prod-001',
        quantity: 100,
        priority: 'NORMAL',
        status: 'PAUSED',
        actualStartAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const resumedWO: WorkOrder = { ...pausedWO, status: 'IN_PROGRESS' };

      mockRepository.findById.mockResolvedValue(pausedWO);
      mockRepository.updateStatus.mockResolvedValue(resumedWO);

      const result = await engine.startWorkOrder({
        tenantId: 'tenant-a',
        workOrderId: 'wo-001',
      });

      expect(result.status).toBe('IN_PROGRESS');
    });

    it('should reject start if not SCHEDULED or PAUSED', async () => {
      const draftWO: WorkOrder = {
        id: 'wo-001',
        tenantId: 'tenant-a',
        orderNumber: 'WO-001',
        productId: 'prod-001',
        quantity: 100,
        priority: 'NORMAL',
        status: 'DRAFT',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockRepository.findById.mockResolvedValue(draftWO);

      await expect(
        engine.startWorkOrder({
          tenantId: 'tenant-a',
          workOrderId: 'wo-001',
        })
      ).rejects.toThrow('WORK_ORDER_NOT_STARTED_STATUS');
    });
  });

  describe('completeWorkOrder', () => {
    it('should complete work order from IN_PROGRESS', async () => {
      const inProgressWO: WorkOrder = {
        id: 'wo-001',
        tenantId: 'tenant-a',
        orderNumber: 'WO-001',
        productId: 'prod-001',
        quantity: 100,
        priority: 'NORMAL',
        status: 'IN_PROGRESS',
        actualStartAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const completedWO: WorkOrder = {
        ...inProgressWO,
        status: 'COMPLETED',
        actualEndAt: new Date().toISOString(),
      };

      mockRepository.findById.mockResolvedValue(inProgressWO);
      mockRepository.updateStatus.mockResolvedValue(completedWO);

      const result = await engine.completeWorkOrder({
        tenantId: 'tenant-a',
        workOrderId: 'wo-001',
        actualQuantity: 98,
      });

      expect(result.status).toBe('COMPLETED');
      expect(result.actualEndAt).toBeDefined();
    });

    it('should enforce actual quantity positivity', async () => {
      const inProgressWO: WorkOrder = {
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

      mockRepository.findById.mockResolvedValue(inProgressWO);

      await expect(
        engine.completeWorkOrder({
          tenantId: 'tenant-a',
          workOrderId: 'wo-001',
          actualQuantity: 0,
        })
      ).rejects.toThrow('INVALID_QUANTITY');
    });

    it('should reject complete if not IN_PROGRESS', async () => {
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

      mockRepository.findById.mockResolvedValue(scheduledWO);

      await expect(
        engine.completeWorkOrder({
          tenantId: 'tenant-a',
          workOrderId: 'wo-001',
          actualQuantity: 100,
        })
      ).rejects.toThrow('WORK_ORDER_NOT_IN_PROGRESS');
    });
  });

  describe('getWorkOrderById', () => {
    it('should return work order when found', async () => {
      const mockWO: WorkOrder = {
        id: 'wo-001',
        tenantId: 'tenant-a',
        orderNumber: 'WO-001',
        productId: 'prod-001',
        quantity: 100,
        priority: 'NORMAL',
        status: 'DRAFT',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockRepository.findById.mockResolvedValue(mockWO);

      const result = await engine.getWorkOrderById('tenant-a', 'wo-001');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('wo-001');
    });

    it('should return null when not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const result = await engine.getWorkOrderById('tenant-a', 'nonexistent');

      expect(result).toBeNull();
    });

    it('should enforce tenant isolation', async () => {
      await expect(
        engine.getWorkOrderById('', 'wo-001')
      ).rejects.toThrow('TENANT_ISOLATION_VIOLATION');
    });
  });

  describe('getWorkOrderByNumber', () => {
    it('should return work order when found', async () => {
      const mockWO: WorkOrder = {
        id: 'wo-001',
        tenantId: 'tenant-a',
        orderNumber: 'WO-2024-001',
        productId: 'prod-001',
        quantity: 100,
        priority: 'NORMAL',
        status: 'DRAFT',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockRepository.findByOrderNumber.mockResolvedValue(mockWO);

      const result = await engine.getWorkOrderByNumber('tenant-a', 'WO-2024-001');

      expect(result).not.toBeNull();
      expect(result?.orderNumber).toBe('WO-2024-001');
    });

    it('should return null when not found', async () => {
      mockRepository.findByOrderNumber.mockResolvedValue(null);

      const result = await engine.getWorkOrderByNumber('tenant-a', 'NONEXISTENT');

      expect(result).toBeNull();
    });

    it('should enforce tenant isolation', async () => {
      await expect(
        engine.getWorkOrderByNumber('', 'WO-001')
      ).rejects.toThrow('TENANT_ISOLATION_VIOLATION');
    });
  });
});
