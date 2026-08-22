/**
 * Location Repository Interface
 * 
 * Repository pattern for Location persistence.
 * 
 * NOTE: Contract-only (E7.1.5).
 * Implementation deferred to E7.1.6 test-driven need.
 */

import type { Location } from '../domain/location.types';
import type { Result } from '../domain/core/result';

/**
 * Filters for querying locations
 */
export interface LocationFilters {
  locationType?: string;
  parentLocationId?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'CLOSED';
  locationCodePattern?: string;
}

/**
 * Location repository interface (contract only)
 * 
 * Implementation deferred to test-driven need.
 */
export interface ILocationRepository {
  findById(tenantId: string, locationId: string): Promise<Result<Location | null>>;
  findByCode(tenantId: string, locationCode: string): Promise<Result<Location | null>>;
  list(tenantId: string, filters?: LocationFilters): Promise<Result<Location[]>>;
  getChildren(tenantId: string, parentLocationId: string): Promise<Result<Location[]>>;
  getDescendants(tenantId: string, parentLocationId: string): Promise<Result<Location[]>>;
  save(location: Location): Promise<Result<Location>>;
  delete(tenantId: string, locationId: string): Promise<Result<void>>;
}
