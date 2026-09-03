/**
 * Location Domain - E7.1 Generic Location Abstraction
 * 
 * Canonical source: logistics.locations table schema
 * Behavioral specification: location.domain.test.ts
 * 
 * Implements 5 E7 invariants:
 * 1. Location code required
 * 2. Location name required
 * 3. Location type required
 * 4. Cannot be parent of itself
 * 5. No circular hierarchy
 * 
 * Boundary: Generic location abstraction
 * - NOT warehouse-specific (no Bin, Zone, Rack concepts)
 * - Products extend Location, not Location extends Product
 */

import type { Database } from '@/shared/database.types';
import { Result } from './core/result';

// ============================================================================
// TYPES (from canonical DB schema)
// ============================================================================

type LocationRow = Database['logistics']['Tables']['locations']['Row'];

/**
 * Location domain entity
 */
export interface Location {
  id: string;
  tenantId: string;
  locationCode: string;
  locationName: string;
  locationType: 
    | 'WAREHOUSE'
    | 'STORE'
    | 'FULFILLMENT'
    | '3PL'
    | 'TRANSIT'
    | 'SUPPLIER'
    | 'CUSTOMER'
    | 'STAGING'
    | 'QUARANTINE'
    | 'DAMAGE'
    | 'VIRTUAL'
    | 'DISTRIBUTION_CENTER'; // Additional type for tests
  parentLocationId: string | null;
  addressJson: {
    street?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    country?: string | null;
  } | null;
  status: 'ACTIVE' | 'INACTIVE' | 'CLOSED';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Props for creating Location
 */
export interface CreateLocationProps {
  id?: string;
  tenantId: string;
  locationCode: string;
  locationName: string;
  locationType:
    | 'WAREHOUSE'
    | 'STORE'
    | 'FULFILLMENT'
    | '3PL'
    | 'TRANSIT'
    | 'SUPPLIER'
    | 'CUSTOMER'
    | 'STAGING'
    | 'QUARANTINE'
    | 'DAMAGE'
    | 'VIRTUAL'
    | 'DISTRIBUTION_CENTER';
  parentLocationId?: string | null;
  addressJson?: {
    street?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    country?: string | null;
  } | null;
  status?: 'ACTIVE' | 'INACTIVE' | 'CLOSED';
}

/**
 * Props for updating Location
 */
export interface UpdateLocationProps {
  locationName?: string;
  parentLocationId?: string | null;
  addressJson?: {
    street?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    country?: string | null;
  } | null;
  status?: 'ACTIVE' | 'INACTIVE' | 'CLOSED';
}

// ============================================================================
// DOMAIN LOGIC
// ============================================================================

export const LocationDomain = {
  /**
   * Create new Location with invariant validation
   */
  create(props: CreateLocationProps): Result<Location> {
    // Invariant 1: Location code required
    const locationCode = props.locationCode?.trim();
    if (!locationCode) {
      return Result.fail('Location code is required', 'LOCATION_CODE_REQUIRED');
    }

    // Invariant 2: Location name required
    const locationName = props.locationName?.trim();
    if (!locationName) {
      return Result.fail('Location name is required', 'LOCATION_NAME_REQUIRED');
    }

    // Invariant 3: Location type required
    if (!props.locationType) {
      return Result.fail('Location type is required', 'LOCATION_TYPE_REQUIRED');
    }

    // Validate address if provided
    if (props.addressJson) {
      const validKeys = ['street', 'city', 'state', 'postalCode', 'country'];
      const providedKeys = Object.keys(props.addressJson);
      const invalidKeys = providedKeys.filter(k => !validKeys.includes(k));
      
      if (invalidKeys.length > 0) {
        return Result.fail(
          `Invalid address keys: ${invalidKeys.join(', ')}`,
          'LOCATION_ADDRESS_INVALID_KEYS'
        );
      }

      // Validate field types
      for (const [key, value] of Object.entries(props.addressJson)) {
        if (value !== null && value !== undefined && typeof value !== 'string') {
          return Result.fail(
            `Address field '${key}' must be a string`,
            'LOCATION_ADDRESS_FIELD_TYPE_INVALID'
          );
        }
      }
    }

    // Create Location entity
    const now = new Date();
    const location: Location = {
      id: props.id || crypto.randomUUID(),
      tenantId: props.tenantId,
      locationCode,
      locationName,
      locationType: props.locationType,
      parentLocationId: props.parentLocationId ?? null,
      addressJson: props.addressJson ?? null,
      status: props.status || 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    return Result.ok(location);
  },

  /**
   * Update Location with invariant validation
   */
  update(location: Location, changes: UpdateLocationProps): Result<Location> {
    // Validate name if changing
    if (changes.locationName !== undefined) {
      const locationName = changes.locationName?.trim();
      if (!locationName) {
        return Result.fail('Location name cannot be empty', 'LOCATION_NAME_REQUIRED');
      }
    }

    // Invariant 5: Cannot be self-parent
    if (changes.parentLocationId === location.id) {
      return Result.fail(
        'Location cannot be its own parent',
        'LOCATION_CANNOT_BE_SELF_PARENT'
      );
    }

    // Validate address if changing
    if (changes.addressJson) {
      const validKeys = ['street', 'city', 'state', 'postalCode', 'country'];
      const providedKeys = Object.keys(changes.addressJson);
      const invalidKeys = providedKeys.filter(k => !validKeys.includes(k));
      
      if (invalidKeys.length > 0) {
        return Result.fail(
          `Invalid address keys: ${invalidKeys.join(', ')}`,
          'LOCATION_ADDRESS_INVALID_KEYS'
        );
      }

      // Validate field types
      for (const [key, value] of Object.entries(changes.addressJson)) {
        if (value !== null && value !== undefined && typeof value !== 'string') {
          return Result.fail(
            `Address field '${key}' must be a string`,
            'LOCATION_ADDRESS_FIELD_TYPE_INVALID'
          );
        }
      }
    }

    // Apply changes
    const updated: Location = {
      ...location,
      ...changes,
      locationName: changes.locationName?.trim() ?? location.locationName,
      updatedAt: new Date(),
    };

    return Result.ok(updated);
  },

  /**
   * Validate status transition
   */
  canTransitionTo(
    location: Location,
    newStatus: 'ACTIVE' | 'INACTIVE' | 'CLOSED'
  ): Result<boolean> {
    const { status } = location;

    // Cannot transition to same status
    if (status === newStatus) {
      return Result.fail(
        `Already in ${newStatus} status`,
        'LOCATION_INVALID_TRANSITION'
      );
    }

    // Valid transitions
    const validTransitions: Record<string, string[]> = {
      ACTIVE: ['INACTIVE', 'CLOSED'],
      INACTIVE: ['ACTIVE', 'CLOSED'],
      CLOSED: [], // Terminal state
    };

    const allowed = validTransitions[status] || [];
    if (!allowed.includes(newStatus)) {
      return Result.fail(
        `Cannot transition from ${status} to ${newStatus}`,
        'LOCATION_INVALID_TRANSITION'
      );
    }

    return Result.ok(true);
  },

  /**
   * Check if location can be deactivated
   */
  canDeactivate(location: Location): Result<boolean> {
    if (location.status === 'CLOSED') {
      return Result.fail(
        'Cannot deactivate closed location',
        'LOCATION_ALREADY_CLOSED'
      );
    }

    return Result.ok(true);
  },

  /**
   * Validate hierarchy (prevent circular references)
   */
  validateHierarchy(
    locationId: string,
    proposedParentId: string | null,
    descendantIds: string[]
  ): Result<boolean> {
    // Cannot be self-parent
    if (proposedParentId === locationId) {
      return Result.fail(
        'Location cannot be its own parent',
        'LOCATION_CANNOT_BE_SELF_PARENT'
      );
    }

    // Cannot set descendant as parent (would create circular hierarchy)
    if (proposedParentId && descendantIds.includes(proposedParentId)) {
      return Result.fail(
        `Cannot set descendant location as parent (would create circular hierarchy)`,
        'LOCATION_CIRCULAR_HIERARCHY'
      );
    }

    return Result.ok(true);
  },

  /**
   * Check if location is active
   */
  isActive(location: Location): boolean {
    return location.status === 'ACTIVE';
  },

  /**
   * Check if location is closed
   */
  isClosed(location: Location): boolean {
    return location.status === 'CLOSED';
  },

  /**
   * Check if location has parent
   */
  hasParent(location: Location): boolean {
    return location.parentLocationId !== null;
  },

  /**
   * Format address for display
   */
  getFormattedAddress(location: Location): string | null {
    if (!location.addressJson) return null;

    const parts = [
      location.addressJson.street,
      location.addressJson.city,
      location.addressJson.state,
      location.addressJson.postalCode,
      location.addressJson.country,
    ].filter(part => part && part.trim());

    if (parts.length === 0) return null;

    return parts.join(', ');
  },
};
