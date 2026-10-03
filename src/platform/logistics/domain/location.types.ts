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
export type { LocationType } from './inventory.types';

/**
 * Location Code
 * 
 * Business identifier for location
 */
export interface LocationCode {
  value: string; // e.g., "WH-001", "STORE-123"
}

/**
 * Location (Core Entity)
 * 
 * Generic location concept
 */
export interface Location {
  id: string;
  tenantId: string;
  
  // Identity
  locationCode: string;
  locationName: string;
  locationType: LocationType;
  
  // Hierarchy (optional, generic)
  parentLocationId?: string | null;
  
  // Address (optional)
  addressJson?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  } | null;
  
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
  addressJson?: Location['addressJson'];
  status?: LocationStatus;
}

/**
 * Update Location Props
 */
export interface UpdateLocationProps {
  locationName?: string;
  locationType?: LocationType;
  parentLocationId?: string;
  addressJson?: Location['addressJson'];
  status?: Location['status'];
}

/**
 * Location Filters
 */
export interface LocationFilters {
  locationType?: LocationType | LocationType[];
  status?: Location['status'];
  parentLocationId?: string;
  locationCodeLike?: string;
  locationNameLike?: string;
}

export type LocationStatus = 'ACTIVE' | 'INACTIVE' | 'CLOSED';

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

