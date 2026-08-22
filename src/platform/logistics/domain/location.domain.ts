/**
 * Location Domain Kernel
 * 
 * Pure business logic for generic location management.
 * Zero dependencies on infrastructure.
 * 
 * Responsibilities:
 * - Location creation and validation
 * - Hierarchy validation (basic)
 * - Status transitions
 * 
 * Note: Location is deliberately generic (not warehouse-specific).
 * Products extend this with their own concepts (e.g., Warehouse adds Bins).
 */

import { Result } from './core/result';
import type {
  Location,
  CreateLocationProps,
  UpdateLocationProps,
  LocationType,
  LocationStatus,
} from './location.types';

export class LocationDomain {
  /**
   * Create new location
   * 
   * Invariants:
   * - Location code required and non-empty
   * - Location name required
   * - Location type required
   * - Cannot be parent of itself
   */
  static create(props: CreateLocationProps): Result<Location> {
    // Required fields
    if (!props.locationCode || props.locationCode.trim() === '') {
      return Result.fail(
        'Location code is required',
        'LOCATION_CODE_REQUIRED'
      );
    }

    if (!props.locationName || props.locationName.trim() === '') {
      return Result.fail(
        'Location name is required',
        'LOCATION_NAME_REQUIRED'
      );
    }

    if (!props.locationType) {
      return Result.fail(
        'Location type is required',
        'LOCATION_TYPE_REQUIRED'
      );
    }

    // Address validation (if provided)
    if (props.addressJson) {
      const addressResult = this.validateAddress(props.addressJson);
      if (addressResult.isFailure) {
        return addressResult as Result<Location>;
      }
    }

    const now = new Date();

    const location: Location = {
      id: props.id || crypto.randomUUID(),
      tenantId: props.tenantId,
      locationCode: props.locationCode.trim(),
      locationName: props.locationName.trim(),
      locationType: props.locationType,
      
      parentLocationId: props.parentLocationId || null,
      
      addressJson: props.addressJson || null,
      
      status: props.status || 'ACTIVE',
      
      createdAt: now,
      updatedAt: now,
    };

    return Result.ok(location);
  }

  /**
   * Update existing location
   * 
   * Cannot change:
   * - tenantId (immutable)
   * - locationCode (business key, immutable)
   * - createdAt (audit)
   */
  static update(
    existingLocation: Location,
    updates: UpdateLocationProps
  ): Result<Location> {
    // Name cannot be empty if provided
    if (updates.locationName !== undefined && 
        (!updates.locationName || updates.locationName.trim() === '')) {
      return Result.fail(
        'Location name cannot be empty',
        'LOCATION_NAME_REQUIRED'
      );
    }

    // Prevent self-parenting
    if (updates.parentLocationId === existingLocation.id) {
      return Result.fail(
        'Location cannot be its own parent',
        'LOCATION_CANNOT_BE_SELF_PARENT'
      );
    }

    // Address validation
    if (updates.addressJson) {
      const addressResult = this.validateAddress(updates.addressJson);
      if (addressResult.isFailure) {
        return addressResult as Result<Location>;
      }
    }

    const updated: Location = {
      ...existingLocation,
      ...updates,
      locationName: updates.locationName?.trim() || existingLocation.locationName,
      updatedAt: new Date(),
    };

    return Result.ok(updated);
  }

  /**
   * Validate location status transition
   */
  static canTransitionTo(
    location: Location,
    newStatus: LocationStatus
  ): Result<void> {
    const validTransitions: Record<LocationStatus, LocationStatus[]> = {
      ACTIVE: ['INACTIVE', 'CLOSED'],
      INACTIVE: ['ACTIVE', 'CLOSED'],
      CLOSED: [], // Terminal state
    };

    const allowed = validTransitions[location.status] || [];

    if (!allowed.includes(newStatus)) {
      return Result.fail(
        `Cannot transition from ${location.status} to ${newStatus}`,
        'LOCATION_INVALID_TRANSITION'
      );
    }

    return Result.ok(undefined);
  }

  /**
   * Check if location can be deactivated
   * 
   * Note: Actual inventory check happens at repository layer.
   * This is domain-level validation only.
   */
  static canDeactivate(location: Location): Result<void> {
    if (location.status === 'CLOSED') {
      return Result.fail(
        'Cannot deactivate closed location',
        'LOCATION_ALREADY_CLOSED'
      );
    }

    return Result.ok(undefined);
  }

  /**
   * Validate circular hierarchy (must be done at repository layer with full tree)
   * 
   * This method validates a proposed parent is not a descendant.
   * Implementation requires full hierarchy traversal (repository responsibility).
   */
  static validateHierarchy(
    locationId: string,
    proposedParentId: string,
    descendantIds: string[]
  ): Result<void> {
    // Cannot be own parent
    if (locationId === proposedParentId) {
      return Result.fail(
        'Location cannot be its own parent',
        'LOCATION_CANNOT_BE_SELF_PARENT'
      );
    }

    // Cannot be parent of own descendant (circular)
    if (descendantIds.includes(proposedParentId)) {
      return Result.fail(
        'Location cannot be moved under its own descendant (circular hierarchy)',
        'LOCATION_CIRCULAR_HIERARCHY'
      );
    }

    return Result.ok(undefined);
  }

  /**
   * Validate address JSON structure
   */
  private static validateAddress(addressJson: Record<string, unknown>): Result<void> {
    const allowedKeys = ['street', 'city', 'state', 'postalCode', 'country'];
    const providedKeys = Object.keys(addressJson);

    // Check for unknown keys
    const unknownKeys = providedKeys.filter(key => !allowedKeys.includes(key));
    if (unknownKeys.length > 0) {
      return Result.fail(
        `Invalid address keys: ${unknownKeys.join(', ')}`,
        'LOCATION_ADDRESS_INVALID_KEYS'
      );
    }

    // All values must be strings (if provided)
    for (const key of providedKeys) {
      if (addressJson[key] !== null && typeof addressJson[key] !== 'string') {
        return Result.fail(
          `Address field '${key}' must be a string`,
          'LOCATION_ADDRESS_FIELD_TYPE_INVALID'
        );
      }
    }

    return Result.ok(undefined);
  }

  /**
   * Check if location is active
   */
  static isActive(location: Location): boolean {
    return location.status === 'ACTIVE';
  }

  /**
   * Check if location is closed
   */
  static isClosed(location: Location): boolean {
    return location.status === 'CLOSED';
  }

  /**
   * Check if location has parent (is child)
   */
  static hasParent(location: Location): boolean {
    return location.parentLocationId !== null;
  }

  /**
   * Get address string (formatted)
   * 
   * NOTE: Presentation helper.
   * May move to API/presentation layer if tests show no domain-level need.
   * Do not treat this as a Logistics OS primitive.
   */
  static getFormattedAddress(location: Location): string | null {
    if (!location.addressJson) return null;

    const parts: string[] = [];
    const address = location.addressJson;

    if (address.street) parts.push(address.street as string);
    if (address.city) parts.push(address.city as string);
    if (address.state) parts.push(address.state as string);
    if (address.postalCode) parts.push(address.postalCode as string);
    if (address.country) parts.push(address.country as string);

    return parts.length > 0 ? parts.join(', ') : null;
  }

  // ========================================================================
  // E7.2 OPERATIONAL EXTENSIONS
  // ========================================================================

  /**
   * E7.2: Deactivate location operation
   * 
   * Transition: ACTIVE → INACTIVE
   * 
   * Use case: Temporary suspension (maintenance, capacity issues)
   * 
   * Invariants:
   * - Must be ACTIVE status
   * - Reason required
   * - Actor (deactivatedBy) required
   */
  static deactivateOperation(
    location: Location,
    context: {
      reason: string;
      deactivatedBy: string;
    }
  ): Result<Location> {
    // Validate reason
    if (!context.reason || context.reason.trim() === '') {
      return Result.fail(
        'Deactivation reason is required',
        'DEACTIVATION_REASON_REQUIRED'
      );
    }

    // Validate actor
    if (!context.deactivatedBy || context.deactivatedBy.trim() === '') {
      return Result.fail(
        'deactivatedBy is required',
        'DEACTIVATED_BY_REQUIRED'
      );
    }

    // Check if already closed
    if (location.status === 'CLOSED') {
      return Result.fail(
        'Cannot deactivate closed location',
        'LOCATION_ALREADY_CLOSED'
      );
    }

    // Use E7.1 frozen contract for transition validation
    const transitionResult = this.canTransitionTo(location, 'INACTIVE');
    if (transitionResult.isFailure) {
      return transitionResult as Result<Location>;
    }

    // Apply state change
    const updated: Location = {
      ...location,
      status: 'INACTIVE',
      updatedAt: new Date(),
    };

    return Result.ok(updated);
  }

  /**
   * E7.2: Close location operation
   * 
   * Transition: ACTIVE/INACTIVE → CLOSED
   * 
   * Use case: Permanent closure (decommission, consolidation)
   * 
   * Invariants:
   * - Cannot close already CLOSED location
   * - Reason required
   * - Actor (closedBy) required
   * - CLOSED is terminal state
   */
  static closeOperation(
    location: Location,
    context: {
      reason: string;
      closedBy: string;
    }
  ): Result<Location> {
    // Validate reason
    if (!context.reason || context.reason.trim() === '') {
      return Result.fail(
        'Close reason is required',
        'CLOSE_REASON_REQUIRED'
      );
    }

    // Validate actor
    if (!context.closedBy || context.closedBy.trim() === '') {
      return Result.fail(
        'closedBy is required',
        'CLOSED_BY_REQUIRED'
      );
    }

    // Use E7.1 frozen contract for transition validation
    const transitionResult = this.canTransitionTo(location, 'CLOSED');
    if (transitionResult.isFailure) {
      return transitionResult as Result<Location>;
    }

    // Apply state change
    const updated: Location = {
      ...location,
      status: 'CLOSED',
      updatedAt: new Date(),
    };

    return Result.ok(updated);
  }

  /**
   * E7.2: Reactivate location operation
   * 
   * Transition: INACTIVE → ACTIVE
   * 
   * Use case: Resume operations after temporary suspension
   * 
   * Invariants:
   * - Must be INACTIVE status
   * - Cannot reactivate CLOSED locations
   * - Reason required
   * - Actor (reactivatedBy) required
   */
  static reactivateOperation(
    location: Location,
    context: {
      reason: string;
      reactivatedBy: string;
    }
  ): Result<Location> {
    // Validate reason
    if (!context.reason || context.reason.trim() === '') {
      return Result.fail(
        'Reactivation reason is required',
        'REACTIVATION_REASON_REQUIRED'
      );
    }

    // Validate actor
    if (!context.reactivatedBy || context.reactivatedBy.trim() === '') {
      return Result.fail(
        'reactivatedBy is required',
        'REACTIVATED_BY_REQUIRED'
      );
    }

    // Use E7.1 frozen contract for transition validation
    const transitionResult = this.canTransitionTo(location, 'ACTIVE');
    if (transitionResult.isFailure) {
      return transitionResult as Result<Location>;
    }

    // Apply state change
    const updated: Location = {
      ...location,
      status: 'ACTIVE',
      updatedAt: new Date(),
    };

    return Result.ok(updated);
  }
}
