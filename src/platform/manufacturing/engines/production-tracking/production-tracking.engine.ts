/**
 * MANUFACTURING OS - PRODUCTION TRACKING ENGINE (M2)
 * 
 * Implements IProductionTrackingContract.
 * Encapsulates production output recording domain logic.
 * 
 * @module platform/manufacturing/engines/production-tracking/production-tracking.engine
 */

import { randomUUID } from 'crypto';
import type {
  IProductionTrackingContract,
  ProductionRecord,
  RecordProductionRequest,
  ProductionSummary,
} from '../../contracts/production-tracking.contract';
import type { IProductionTrackingRepository } from './production-tracking-repository.interface';
import type { IWorkOrderRepository } from '../work-order/work-order-repository.interface';

/**
 * Production Tracking Engine (M2)
 * 
 * Implements Manufacturing OS production recording semantics:
 * - Production output recording
 * - Quantity tracking (produced vs rejected)
 * - Production history
 * - Aggregate metrics
 * 
 * Invariants enforced:
 * - Work order must exist and be IN_PROGRESS
 * - Quantities must be non-negative
 * - Production records immutable once created
 */
export class ProductionTrackingEngine implements IProductionTrackingContract {
  constructor(
    private readonly productionRepository: IProductionTrackingRepository,
    private readonly workOrderRepository: IWorkOrderRepository
  ) {}

  async recordProduction(request: RecordProductionRequest): Promise<ProductionRecord> {
    // Validate tenant isolation
    if (!request.tenantId) {
      throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    }

    // Validate quantities
    if (request.quantityProduced < 0) {
      throw new Error('INVALID_QUANTITY: quantityProduced must be non-negative');
    }

    if (request.quantityRejected !== undefined && request.quantityRejected < 0) {
      throw new Error('INVALID_QUANTITY: quantityRejected must be non-negative');
    }

    // Verify work order exists and is IN_PROGRESS
    const workOrder = await this.workOrderRepository.findById(request.tenantId, request.workOrderId);

    if (!workOrder) {
      throw new Error('WORK_ORDER_NOT_FOUND: Work order does not exist');
    }

    if (workOrder.status !== 'IN_PROGRESS') {
      throw new Error(
        'WORK_ORDER_NOT_IN_PROGRESS: Can only record production for work orders in progress'
      );
    }

    // Build production record entity
    const productionRecord: ProductionRecord = {
      id: randomUUID(),
      tenantId: request.tenantId,
      workOrderId: request.workOrderId,
      batchNumber: request.batchNumber,
      quantityProduced: request.quantityProduced,
      quantityRejected: request.quantityRejected || 0,
      status: 'COMPLETED',
      producedAt: new Date().toISOString(),
      producedBy: request.producedBy,
      notes: request.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Persist
    return await this.productionRepository.create(productionRecord);
  }

  async getProductionHistory(tenantId: string, workOrderId: string): Promise<ProductionRecord[]> {
    // Validate tenant isolation
    if (!tenantId) {
      throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    }

    return await this.productionRepository.findByWorkOrder(tenantId, workOrderId);
  }

  async getProductionSummary(
    tenantId: string,
    workOrderId: string,
    plannedQuantity: number
  ): Promise<ProductionSummary> {
    // Validate tenant isolation
    if (!tenantId) {
      throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    }

    // Verify work order exists
    const workOrder = await this.workOrderRepository.findById(tenantId, workOrderId);

    if (!workOrder) {
      throw new Error('WORK_ORDER_NOT_FOUND: Work order does not exist');
    }

    // Get production history
    const records = await this.productionRepository.findByWorkOrder(tenantId, workOrderId);

    // Calculate aggregates
    const totalProduced = records.reduce((sum, r) => sum + r.quantityProduced, 0);
    const totalRejected = records.reduce((sum, r) => sum + r.quantityRejected, 0);
    const totalRecords = records.length;

    // Calculate completion percentage
    const completionPercentage = plannedQuantity > 0 
      ? Math.round((totalProduced / plannedQuantity) * 100) 
      : 0;

    // Calculate quality rate
    const totalAttempted = totalProduced + totalRejected;
    const qualityRate = totalAttempted > 0 
      ? Math.round((totalProduced / totalAttempted) * 100) 
      : 100;

    return {
      workOrderId,
      totalProduced,
      totalRejected,
      totalRecords,
      completionPercentage,
      qualityRate,
    };
  }
}
