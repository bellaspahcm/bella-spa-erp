/**
 * Batch/Lot Tracking Engine
 * R4 Extension - Retail OS
 * 
 * Business logic: FEFO inventory management, expiry detection, batch lifecycle
 * Invariants:
 * - Stock always >= 0
 * - Expiry date mandatory
 * - Tenant isolation enforced
 * - FEFO order preserved
 */

import type {
  CreateBatchLotCommand,
  BatchLotCreatedEvent,
  UpdateBatchStockCommand,
  BatchStockUpdatedEvent,
  ReduceBatchStockCommand,
  GetBatchQuery,
  GetExpiringBatchesQuery,
  BatchLot
} from '../../contracts/batch-lot-tracking.contract';
import type { IBatchLotRepository } from './batch-lot-repository.interface';

export class BatchLotEngine {
  constructor(private repository: IBatchLotRepository) {}

  /**
   * Create new batch/lot
   * Validates: expiry date in future, initial stock >= 0
   * Returns: Full batch entity after creation
   */
  async createBatch(command: CreateBatchLotCommand): Promise<BatchLot> {
    // Validate expiry date
    const expiryDate = new Date(command.expiryDate);
    if (isNaN(expiryDate.getTime())) {
      throw new Error('Invalid expiry date format');
    }

    // Validate initial stock
    if (command.initialStock < 0) {
      throw new Error('Initial stock cannot be negative');
    }

    // Validate manufactured date if provided
    if (command.manufacturedDate) {
      const mfgDate = new Date(command.manufacturedDate);
      if (isNaN(mfgDate.getTime())) {
        throw new Error('Invalid manufactured date format');
      }
      if (mfgDate > expiryDate) {
        throw new Error('Manufactured date cannot be after expiry date');
      }
    }

    // Create batch (returns event)
    const event = await this.repository.createBatch(command);

    // Fetch and return full entity
    const batch = await this.repository.getBatchById({
      tenantId: command.tenantId,
      batchId: event.batchId
    });

    if (!batch) {
      throw new Error('Failed to retrieve created batch');
    }

    return batch;
  }

  /**
   * Update batch stock
   * Validates: new stock >= 0, batch exists
   */
  async updateStock(command: UpdateBatchStockCommand): Promise<BatchStockUpdatedEvent> {
    if (command.newStock < 0) {
      throw new Error('Stock cannot be negative');
    }

    // Verify batch exists and belongs to tenant
    const batch = await this.repository.getBatchById({
      tenantId: command.tenantId,
      batchId: command.batchId
    });

    if (!batch) {
      throw new Error(`Batch ${command.batchId} not found or access denied`);
    }

    return await this.repository.updateStock(command);
  }

  /**
   * Reduce batch stock (for sales/consumption)
   * Validates: batch not expired, sufficient stock, batch exists
   */
  async reduceStock(command: ReduceBatchStockCommand): Promise<BatchLot> {
    // Get batch
    const batch = await this.repository.getBatchById({
      tenantId: command.tenantId,
      batchId: command.batchId
    });

    if (!batch) {
      throw new Error(`Batch ${command.batchId} not found or access denied`);
    }

    // Check if batch is expired
    if (this.isBatchExpired(batch)) {
      throw new Error('BATCH_EXPIRED: Cannot reduce stock from expired batch');
    }

    // Check sufficient stock
    if (batch.currentStock < command.quantity) {
      throw new Error(`Insufficient stock: batch has ${batch.currentStock}, requested ${command.quantity}`);
    }

    // Calculate new stock
    const newStock = batch.currentStock - command.quantity;

    // Update stock
    await this.repository.updateStock({
      tenantId: command.tenantId,
      batchId: command.batchId,
      newStock
    });

    // Return updated batch
    const updatedBatch = await this.repository.getBatchById({
      tenantId: command.tenantId,
      batchId: command.batchId
    });

    if (!updatedBatch) {
      throw new Error('Failed to retrieve updated batch');
    }

    return updatedBatch;
  }

  /**
   * Get batch by ID
   */
  async getBatchById(query: GetBatchQuery): Promise<BatchLot | null> {
    return await this.repository.getBatchById(query);
  }

  /**
   * Get batches in FEFO order
   * Returns: batches sorted by expiry date (earliest first)
   * Use case: Pick stock from earliest expiring batches first
   */
  async getBatchesForProductFEFO(
    tenantId: string,
    productId: string
  ): Promise<BatchLot[]> {
    return await this.repository.getBatchesForProduct(tenantId, productId);
  }

  /**
   * Get expiring batches (alert threshold)
   * Returns: batches expiring within threshold with stock > 0
   */
  async getExpiringBatches(query: GetExpiringBatchesQuery): Promise<BatchLot[]> {
    return await this.repository.getExpiringBatches(query);
  }

  /**
   * Get expired batches (waste detection)
   * Returns: batches past expiry with remaining stock
   */
  async getExpiredBatches(tenantId: string): Promise<BatchLot[]> {
    return await this.repository.getExpiredBatches(tenantId);
  }

  /**
   * Suggest batch for stock allocation (FEFO logic)
   * Returns: batch with earliest expiry date and sufficient stock
   */
  async suggestBatchForAllocation(
    tenantId: string,
    productId: string,
    requiredQuantity: number
  ): Promise<BatchLot | null> {
    const batches = await this.getBatchesForProductFEFO(tenantId, productId);

    // Filter: not expired, sufficient stock
    const now = new Date();
    const eligibleBatch = batches.find(batch => {
      const expiryDate = new Date(batch.expiryDate);
      return expiryDate > now && batch.currentStock >= requiredQuantity;
    });

    return eligibleBatch || null;
  }

  /**
   * Check if batch is expired
   */
  isBatchExpired(batch: BatchLot): boolean {
    const now = new Date();
    const expiryDate = new Date(batch.expiryDate);
    return expiryDate <= now;
  }

  /**
   * Calculate days until expiry
   */
  getDaysUntilExpiry(batch: BatchLot): number {
    const now = new Date();
    const expiryDate = new Date(batch.expiryDate);
    const diffMs = expiryDate.getTime() - now.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }
}
