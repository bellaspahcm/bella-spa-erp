/**
 * Batch/Lot Tracking Engine Tests
 * R4 Extension - Retail OS
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { BatchLotEngine } from '../batch-lot.engine';
import type { IBatchLotRepository } from '../batch-lot-repository.interface';
import type {
  BatchLot,
  CreateBatchLotCommand,
  BatchLotCreatedEvent,
  UpdateBatchStockCommand,
  BatchStockUpdatedEvent,
  GetBatchQuery,
  GetExpiringBatchesQuery
} from '../../../contracts/batch-lot-tracking.contract';

class MockBatchLotRepository implements IBatchLotRepository {
  private batches: Map<string, BatchLot> = new Map();
  private nextId = 1;

  async createBatch(command: CreateBatchLotCommand): Promise<BatchLotCreatedEvent> {
    const batchId = `batch-${this.nextId++}`;
    const batch: BatchLot = {
      id: batchId,
      tenantId: command.tenantId,
      productId: command.productId,
      batchNumber: command.batchNumber,
      lotNumber: command.lotNumber || null,
      manufacturedDate: command.manufacturedDate || null,
      expiryDate: command.expiryDate,
      initialStock: command.initialStock,
      currentStock: command.initialStock,
      unit: command.unit,
      supplierId: command.supplierId || null,
      notes: command.notes || null,
      metadata: command.metadata || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.batches.set(batchId, batch);

    return {
      eventType: 'BATCH_LOT_CREATED',
      tenantId: command.tenantId,
      batchId,
      productId: command.productId,
      batchNumber: command.batchNumber,
      expiryDate: command.expiryDate,
      initialStock: command.initialStock,
      timestamp: new Date().toISOString()
    };
  }

  async updateStock(command: UpdateBatchStockCommand): Promise<BatchStockUpdatedEvent> {
    const batch = this.batches.get(command.batchId);
    if (!batch || batch.tenantId !== command.tenantId) {
      throw new Error('Batch not found');
    }

    const previousStock = batch.currentStock;
    batch.currentStock = command.newStock;
    batch.updatedAt = new Date().toISOString();

    return {
      eventType: 'BATCH_STOCK_UPDATED',
      tenantId: command.tenantId,
      batchId: command.batchId,
      previousStock,
      newStock: command.newStock,
      timestamp: new Date().toISOString()
    };
  }

  async getBatchById(query: GetBatchQuery): Promise<BatchLot | null> {
    const batch = this.batches.get(query.batchId);
    if (!batch || batch.tenantId !== query.tenantId) {
      return null;
    }
    return batch;
  }

  async getBatchesForProduct(tenantId: string, productId: string): Promise<BatchLot[]> {
    return Array.from(this.batches.values())
      .filter(b => b.tenantId === tenantId && b.productId === productId)
      .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
  }

  async getExpiringBatches(query: GetExpiringBatchesQuery): Promise<BatchLot[]> {
    const threshold = new Date(query.thresholdDate);
    return Array.from(this.batches.values())
      .filter(b => 
        b.tenantId === query.tenantId && 
        new Date(b.expiryDate) <= threshold &&
        b.currentStock > 0
      )
      .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
  }

  async getExpiredBatches(tenantId: string): Promise<BatchLot[]> {
    const now = new Date();
    return Array.from(this.batches.values())
      .filter(b => 
        b.tenantId === tenantId && 
        new Date(b.expiryDate) <= now &&
        b.currentStock > 0
      )
      .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
  }
}

describe('BatchLotEngine', () => {
  let engine: BatchLotEngine;
  let repository: MockBatchLotRepository;

  beforeEach(() => {
    repository = new MockBatchLotRepository();
    engine = new BatchLotEngine(repository);
  });

  describe('createBatch', () => {
    it('should create batch with valid data', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const command: CreateBatchLotCommand = {
        tenantId: 'tenant-1',
        productId: 'prod-1',
        batchNumber: 'BATCH-001',
        expiryDate: tomorrow.toISOString(),
        initialStock: 100,
        unit: 'kg'
      };

      const batch = await engine.createBatch(command);

      expect(batch.tenantId).toBe('tenant-1');
      expect(batch.batchNumber).toBe('BATCH-001');
      expect(batch.initialStock).toBe(100);
      expect(batch.currentStock).toBe(100);
      expect(batch.productId).toBe('prod-1');
    });

    it('should reject negative initial stock', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const command: CreateBatchLotCommand = {
        tenantId: 'tenant-1',
        productId: 'prod-1',
        batchNumber: 'BATCH-002',
        expiryDate: tomorrow.toISOString(),
        initialStock: -50,
        unit: 'kg'
      };

      await expect(engine.createBatch(command)).rejects.toThrow('Initial stock cannot be negative');
    });

    it('should reject invalid expiry date format', async () => {
      const command: CreateBatchLotCommand = {
        tenantId: 'tenant-1',
        productId: 'prod-1',
        batchNumber: 'BATCH-003',
        expiryDate: 'invalid-date',
        initialStock: 100,
        unit: 'kg'
      };

      await expect(engine.createBatch(command)).rejects.toThrow('Invalid expiry date format');
    });

    it('should reject manufactured date after expiry date', async () => {
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const command: CreateBatchLotCommand = {
        tenantId: 'tenant-1',
        productId: 'prod-1',
        batchNumber: 'BATCH-004',
        manufacturedDate: today.toISOString(),
        expiryDate: yesterday.toISOString(),
        initialStock: 100,
        unit: 'kg'
      };

      await expect(engine.createBatch(command)).rejects.toThrow('Manufactured date cannot be after expiry date');
    });
  });

  describe('updateStock', () => {
    it('should update batch stock', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const createCmd: CreateBatchLotCommand = {
        tenantId: 'tenant-1',
        productId: 'prod-1',
        batchNumber: 'BATCH-005',
        expiryDate: tomorrow.toISOString(),
        initialStock: 100,
        unit: 'kg'
      };
      const created = await engine.createBatch(createCmd);

      const updateCmd: UpdateBatchStockCommand = {
        tenantId: 'tenant-1',
        batchId: created.id,
        newStock: 75
      };
      const event = await engine.updateStock(updateCmd);

      expect(event.eventType).toBe('BATCH_STOCK_UPDATED');
      expect(event.previousStock).toBe(100);
      expect(event.newStock).toBe(75);
    });

    it('should reject negative stock', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const createCmd: CreateBatchLotCommand = {
        tenantId: 'tenant-1',
        productId: 'prod-1',
        batchNumber: 'BATCH-006',
        expiryDate: tomorrow.toISOString(),
        initialStock: 100,
        unit: 'kg'
      };
      const created = await engine.createBatch(createCmd);

      const updateCmd: UpdateBatchStockCommand = {
        tenantId: 'tenant-1',
        batchId: created.id,
        newStock: -10
      };

      await expect(engine.updateStock(updateCmd)).rejects.toThrow('Stock cannot be negative');
    });

    it('should reject update for non-existent batch', async () => {
      const updateCmd: UpdateBatchStockCommand = {
        tenantId: 'tenant-1',
        batchId: 'non-existent',
        newStock: 50
      };

      await expect(engine.updateStock(updateCmd)).rejects.toThrow('not found');
    });
  });

  describe('getBatchesForProductFEFO', () => {
    it('should return batches in FEFO order (earliest expiry first)', async () => {
      const day1 = new Date();
      day1.setDate(day1.getDate() + 1);
      const day3 = new Date();
      day3.setDate(day3.getDate() + 3);
      const day2 = new Date();
      day2.setDate(day2.getDate() + 2);

      // Create batches out of order
      await engine.createBatch({
        tenantId: 'tenant-1',
        productId: 'prod-1',
        batchNumber: 'BATCH-MIDDLE',
        expiryDate: day3.toISOString(),
        initialStock: 100,
        unit: 'kg'
      });

      await engine.createBatch({
        tenantId: 'tenant-1',
        productId: 'prod-1',
        batchNumber: 'BATCH-FIRST',
        expiryDate: day1.toISOString(),
        initialStock: 50,
        unit: 'kg'
      });

      await engine.createBatch({
        tenantId: 'tenant-1',
        productId: 'prod-1',
        batchNumber: 'BATCH-LAST',
        expiryDate: day2.toISOString(),
        initialStock: 75,
        unit: 'kg'
      });

      const batches = await engine.getBatchesForProductFEFO('tenant-1', 'prod-1');

      expect(batches).toHaveLength(3);
      expect(batches[0].batchNumber).toBe('BATCH-FIRST');
      expect(batches[1].batchNumber).toBe('BATCH-LAST');
      expect(batches[2].batchNumber).toBe('BATCH-MIDDLE');
    });
  });

  describe('getExpiringBatches', () => {
    it('should return batches expiring within threshold', async () => {
      const today = new Date();
      const in3days = new Date();
      in3days.setDate(today.getDate() + 3);
      const in7days = new Date();
      in7days.setDate(today.getDate() + 7);
      const in10days = new Date();
      in10days.setDate(today.getDate() + 10);

      await engine.createBatch({
        tenantId: 'tenant-1',
        productId: 'prod-1',
        batchNumber: 'BATCH-SOON',
        expiryDate: in3days.toISOString(),
        initialStock: 50,
        unit: 'kg'
      });

      await engine.createBatch({
        tenantId: 'tenant-1',
        productId: 'prod-2',
        batchNumber: 'BATCH-OK',
        expiryDate: in10days.toISOString(),
        initialStock: 100,
        unit: 'kg'
      });

      const threshold = new Date();
      threshold.setDate(today.getDate() + 5);

      const expiring = await engine.getExpiringBatches({
        tenantId: 'tenant-1',
        thresholdDate: threshold.toISOString()
      });

      expect(expiring).toHaveLength(1);
      expect(expiring[0].batchNumber).toBe('BATCH-SOON');
    });

    it('should exclude batches with zero stock', async () => {
      const in2days = new Date();
      in2days.setDate(in2days.getDate() + 2);

      const created = await engine.createBatch({
        tenantId: 'tenant-1',
        productId: 'prod-1',
        batchNumber: 'BATCH-EMPTY',
        expiryDate: in2days.toISOString(),
        initialStock: 50,
        unit: 'kg'
      });

      // Deplete stock
      await engine.updateStock({
        tenantId: 'tenant-1',
        batchId: created.id,
        newStock: 0
      });

      const threshold = new Date();
      threshold.setDate(threshold.getDate() + 5);

      const expiring = await engine.getExpiringBatches({
        tenantId: 'tenant-1',
        thresholdDate: threshold.toISOString()
      });

      expect(expiring).toHaveLength(0);
    });
  });

  describe('getExpiredBatches', () => {
    it('should return expired batches with remaining stock', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      await engine.createBatch({
        tenantId: 'tenant-1',
        productId: 'prod-1',
        batchNumber: 'BATCH-EXPIRED',
        expiryDate: yesterday.toISOString(),
        initialStock: 30,
        unit: 'kg'
      });

      await engine.createBatch({
        tenantId: 'tenant-1',
        productId: 'prod-2',
        batchNumber: 'BATCH-GOOD',
        expiryDate: tomorrow.toISOString(),
        initialStock: 100,
        unit: 'kg'
      });

      const expired = await engine.getExpiredBatches('tenant-1');

      expect(expired).toHaveLength(1);
      expect(expired[0].batchNumber).toBe('BATCH-EXPIRED');
    });
  });

  describe('suggestBatchForAllocation', () => {
    it('should suggest earliest expiring batch with sufficient stock', async () => {
      const in3days = new Date();
      in3days.setDate(in3days.getDate() + 3);
      const in7days = new Date();
      in7days.setDate(in7days.getDate() + 7);

      await engine.createBatch({
        tenantId: 'tenant-1',
        productId: 'prod-1',
        batchNumber: 'BATCH-SMALL',
        expiryDate: in3days.toISOString(),
        initialStock: 20,
        unit: 'kg'
      });

      await engine.createBatch({
        tenantId: 'tenant-1',
        productId: 'prod-1',
        batchNumber: 'BATCH-LARGE',
        expiryDate: in7days.toISOString(),
        initialStock: 100,
        unit: 'kg'
      });

      const suggested = await engine.suggestBatchForAllocation('tenant-1', 'prod-1', 50);

      expect(suggested).not.toBeNull();
      expect(suggested?.batchNumber).toBe('BATCH-LARGE');
    });

    it('should return null if no batch has sufficient stock', async () => {
      const in5days = new Date();
      in5days.setDate(in5days.getDate() + 5);

      await engine.createBatch({
        tenantId: 'tenant-1',
        productId: 'prod-1',
        batchNumber: 'BATCH-SMALL',
        expiryDate: in5days.toISOString(),
        initialStock: 20,
        unit: 'kg'
      });

      const suggested = await engine.suggestBatchForAllocation('tenant-1', 'prod-1', 100);

      expect(suggested).toBeNull();
    });

    it('should exclude expired batches', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      await engine.createBatch({
        tenantId: 'tenant-1',
        productId: 'prod-1',
        batchNumber: 'BATCH-EXPIRED-BIG',
        expiryDate: yesterday.toISOString(),
        initialStock: 200,
        unit: 'kg'
      });

      await engine.createBatch({
        tenantId: 'tenant-1',
        productId: 'prod-1',
        batchNumber: 'BATCH-GOOD-SMALL',
        expiryDate: tomorrow.toISOString(),
        initialStock: 50,
        unit: 'kg'
      });

      const suggested = await engine.suggestBatchForAllocation('tenant-1', 'prod-1', 30);

      expect(suggested).not.toBeNull();
      expect(suggested?.batchNumber).toBe('BATCH-GOOD-SMALL');
    });
  });

  describe('isBatchExpired', () => {
    it('should return true for expired batch', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const batch: BatchLot = {
        id: 'batch-1',
        tenantId: 'tenant-1',
        productId: 'prod-1',
        batchNumber: 'BATCH-OLD',
        lotNumber: null,
        manufacturedDate: null,
        expiryDate: yesterday.toISOString(),
        initialStock: 100,
        currentStock: 50,
        unit: 'kg',
        supplierId: null,
        notes: null,
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      expect(engine.isBatchExpired(batch)).toBe(true);
    });

    it('should return false for future expiry', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const batch: BatchLot = {
        id: 'batch-2',
        tenantId: 'tenant-1',
        productId: 'prod-1',
        batchNumber: 'BATCH-FRESH',
        lotNumber: null,
        manufacturedDate: null,
        expiryDate: tomorrow.toISOString(),
        initialStock: 100,
        currentStock: 100,
        unit: 'kg',
        supplierId: null,
        notes: null,
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      expect(engine.isBatchExpired(batch)).toBe(false);
    });
  });

  describe('getDaysUntilExpiry', () => {
    it('should calculate days until expiry correctly', () => {
      const in5days = new Date();
      in5days.setDate(in5days.getDate() + 5);

      const batch: BatchLot = {
        id: 'batch-3',
        tenantId: 'tenant-1',
        productId: 'prod-1',
        batchNumber: 'BATCH-FUTURE',
        lotNumber: null,
        manufacturedDate: null,
        expiryDate: in5days.toISOString(),
        initialStock: 100,
        currentStock: 100,
        unit: 'kg',
        supplierId: null,
        notes: null,
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const days = engine.getDaysUntilExpiry(batch);
      expect(days).toBeGreaterThanOrEqual(4);
      expect(days).toBeLessThanOrEqual(6);
    });

    it('should return negative days for expired batch', () => {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const batch: BatchLot = {
        id: 'batch-4',
        tenantId: 'tenant-1',
        productId: 'prod-1',
        batchNumber: 'BATCH-PAST',
        lotNumber: null,
        manufacturedDate: null,
        expiryDate: threeDaysAgo.toISOString(),
        initialStock: 100,
        currentStock: 50,
        unit: 'kg',
        supplierId: null,
        notes: null,
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const days = engine.getDaysUntilExpiry(batch);
      expect(days).toBeLessThan(0);
    });
  });
});
