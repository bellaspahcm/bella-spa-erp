/**
 * MANUFACTURING OS - PRODUCTION TRACKING REPOSITORY INTERFACE
 * 
 * Repository contract for Production Record persistence.
 * 
 * @module platform/manufacturing/engines/production-tracking
 */

import type { ProductionRecord } from '../../contracts/production-tracking.contract';

export interface IProductionTrackingRepository {
  /**
   * Create new production record
   * Production records are immutable once created
   */
  create(record: ProductionRecord): Promise<ProductionRecord>;

  /**
   * Find all production records for a work order
   * Ordered by producedAt DESC (most recent first)
   */
  findByWorkOrder(tenantId: string, workOrderId: string): Promise<ProductionRecord[]>;
}
