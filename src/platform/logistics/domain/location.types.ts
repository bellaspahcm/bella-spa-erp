/**
 * Logistics OS — Location Domain Types
 * 
 * Generic location abstraction (not warehouse-specific bins).
 * Products can extend with specific location types (bins, slots, etc.).
 * 
 * Design Principles:
 * - Generic (not bin-specific)
 * - Extensible (Products add specific hierarchies)
 * - Product-agnostic
 * 
 * @module logistics/domain/location
 */

import { LocationId, LocationType } from './inventory.types';

// Re-export for domain use
export type { LocationType };

/**
 * Location Code
 * 
 * Business identifier for location
 */
export interface LocationCode {
  value: string; // e.g., "WH-001", "STORE-123"
}

/**
 * Location Status
 */
export type LocationStatus = 'ACTIVE' | 'INACTIVE' | 'CLOSED';

/**
 * Location (Core Entity)
 * 
 * Generic location concept
 */
export interface Location {
  id: LocationId;
  tenantId: string;
  
  // Identity
  locationCode: LocationCode;
  locationName: string;
  locationType: LocationType;
  
  // Hierarchy (optional, generic)
  parentLocationId?: LocationId;
  
  // Address (optional)
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  
  // Status
  status: LocationStatus;
  
  // Audit
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create Location Props
 */
export interface CreateLocationProps {
  id?: string;
  tenantId: string;
  locationCode: string;
  locationName: string;
  locationType: LocationType;
  parentLocationId?: string;
  address?: Location['address'];
  status?: LocationStatus;
  createdBy?: string;
}

/**
 * Update Location Props
 */
export interface UpdateLocationProps {
  locationName?: string;
  locationType?: LocationType;
  parentLocationId?: string;
  address?: Location['address'];
  status?: LocationStatus;
  updatedBy?: string;
}

/**
 * Location Filters
 */
export interface LocationFilters {
  locationType?: LocationType | LocationType[];
  status?: LocationStatus;
  parentLocationId?: string;
  locationCodeLike?: string;
  locationNameLike?: string;
}

/**
 * Location Domain Error
 */
export class LocationDomainError extends Error {
  constructor(
    message: string,
    public code: string,
    public field?: string
  ) {
    super(message);
    this.name = 'LocationDomainError';
  }
}

export const LocationErrorCodes = {
  CODE_REQUIRED: 'CODE_REQUIRED',
  NAME_REQUIRED: 'NAME_REQUIRED',
  TYPE_REQUIRED: 'TYPE_REQUIRED',
  CODE_DUPLICATE: 'CODE_DUPLICATE',
  LOCATION_NOT_FOUND: 'LOCATION_NOT_FOUND',
  CANNOT_DELETE_WITH_INVENTORY: 'CANNOT_DELETE_WITH_INVENTORY',
} as const;

