/**
 * UOM Repository Interface
 * 
 * Repository pattern for Unit of Measure persistence.
 * 
 * NOTE: Contract-only (E7.1.5).
 * Implementation deferred to E7.1.6 test-driven need.
 */

import type { UnitOfMeasure } from '../domain/uom.types';
import type { Result } from '../domain/core/result';

/**
 * Filters for querying UOMs
 */
export interface UOMFilters {
  category?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  baseUomCode?: string;
}

/**
 * UOM repository interface (contract only)
 * 
 * Implementation deferred to test-driven need.
 */
export interface IUOMRepository {
  findById(tenantId: string, uomId: string): Promise<Result<UnitOfMeasure | null>>;
  findByCode(tenantId: string, uomCode: string): Promise<Result<UnitOfMeasure | null>>;
  list(tenantId: string, filters?: UOMFilters): Promise<Result<UnitOfMeasure[]>>;
  save(uom: UnitOfMeasure): Promise<Result<UnitOfMeasure>>;
  delete(tenantId: string, uomId: string): Promise<Result<void>>;
}
