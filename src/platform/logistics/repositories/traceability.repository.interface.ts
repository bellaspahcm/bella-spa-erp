/**
 * Traceability Repository Interface
 * 
 * Repository pattern for Traceability (lot/serial tracking) persistence.
 * 
 * NOTE: Contract-only (E7.1.5).
 * Implementation deferred to E7.1.6 test-driven need.
 */

import type { Traceability } from '../domain/traceability.types';
import type { Result } from '../domain/core/result';

/**
 * Filters for querying traceability records
 */
export interface TraceabilityFilters {
  itemId?: string;
  lotNumber?: string;
  serialNumber?: string;
  recallStatus?: 'NONE' | 'RECALLED' | 'DESTROYED';
  complianceStatus?: 'COMPLIANT' | 'NON_COMPLIANT' | 'UNDER_REVIEW';
  expiryDateBefore?: Date;
  expiryDateAfter?: Date;
}

/**
 * Traceability repository interface (contract only)
 * 
 * Implementation deferred to test-driven need.
 */
export interface ITraceabilityRepository {
  findById(tenantId: string, traceabilityId: string): Promise<Result<Traceability | null>>;
  findByLot(tenantId: string, itemId: string, lotNumber: string): Promise<Result<Traceability | null>>;
  findBySerial(tenantId: string, itemId: string, serialNumber: string): Promise<Result<Traceability | null>>;
  list(tenantId: string, filters?: TraceabilityFilters): Promise<Result<Traceability[]>>;
  save(traceability: Traceability): Promise<Result<Traceability>>;
}
