/**
 * Batch/Lot Tracking Repository Interface
 * R4 Extension - Retail OS
 * 
 * Purpose: Persistence interface for batch/lot inventory operations
 * Supports: Expiry tracking, FEFO logic, perishable goods management
 */

import type {
  CreateBatchLotCommand,
  BatchLotCreatedEvent,
  UpdateBatchStockCommand,
  BatchStockUpdatedEvent,
  GetBatchQuery,
  GetExpiringBatchesQuery,
  BatchLot
} from '../../contracts/batch-lot-tracking.contract';

export interface IBatchLotRepository {
  /**
   * Create new batch/lot record
   * Enforces: tenant isolation, expiry date validation, product reference
   */
  createBatch(command: CreateBatchLotCommand): Promise<BatchLotCreatedEvent>;

  /**
   * Update batch stock level
   * Enforces: non-negative stock, tenant isolation
   */
  updateStock(command: UpdateBatchStockCommand): Promise<BatchStockUpdatedEvent>;

  /**
   * Get batch by ID
   * Returns: null if not found or wrong tenant
   */
  getBatchById(query: GetBatchQuery): Promise<BatchLot | null>;

  /**
   * Get all batches for a product (FEFO order)
   * Returns: batches sorted by expiry_date ASC (First Expiry First Out)
   */
  getBatchesForProduct(
    tenantId: string,
    productId: string
  ): Promise<BatchLot[]>;

  /**
   * Get expiring batches
   * Returns: batches expiring within threshold, sorted by expiry ASC
   */
  getExpiringBatches(query: GetExpiringBatchesQuery): Promise<BatchLot[]>;

  /**
   * Get expired batches with remaining stock
   * Returns: batches past expiry date with current_stock > 0
   */
  getExpiredBatches(tenantId: string): Promise<BatchLot[]>;
}
