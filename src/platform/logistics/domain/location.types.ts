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
  id: LocationId;
  tenantId: string;
  
  // Identity
  location_code: LocationCode;
  location_name: string;
  locationType: LocationType;
  
  // Hierarchy (optional, generic)
  parent_locationId?: LocationId;
  
  // Address (optional)
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  
  // Status
  status: 'ACTIVE' | 'INACTIVE' | 'CLOSED';
  
  // Audit
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create Location Props
 */
export interface CreateLocationProps {
  tenantId: string;
  location_code: string;
  location_name: string;
  locationType: LocationType;
  parent_locationId?: string;
  address?: Location['address'];
}

/**
 * Update Location Props
 */
export interface UpdateLocationProps {
  location_name?: string;
  locationType?: LocationType;
  parent_locationId?: string;
  address?: Location['address'];
  status?: Location['status'];
}

/**
 * Location Filters
 */
export interface LocationFilters {
  locationType?: LocationType | LocationType[];
  status?: Location['status'];
  parent_locationId?: string;
  location_code_like?: string;
  location_name_like?: string;
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

