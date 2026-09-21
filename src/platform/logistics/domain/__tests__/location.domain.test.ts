/**
 * Location Domain Tests
 * 
 * Test Coverage:
 * - 5 domain invariants
 * - Location identity & uniqueness
 * - Hierarchy validation
 * - Status transitions
 * - Address validation
 * - Result<T> error paths
 * 
 * Boundary Verification:
 * - Location is generic (no Warehouse-specific concepts)
 * - No Bin, Zone, Rack, Putaway logic
 * - Products extend Location, not Location extends Product
 */

import { LocationDomain } from '../location.domain';
import type { CreateLocationProps, Location } from '../location.types';

describe('LocationDomain', () => {
  const baseProps: CreateLocationProps = {
    tenantId: 'tenant-1',
    locationCode: 'LOC-001',
    locationName: 'Main Warehouse',
    locationType: 'WAREHOUSE',
  };

  describe('create() - Invariant #1: Location code required', () => {
    it('should fail if location code is missing', () => {
      const props = { ...baseProps, locationCode: '' };
      const result = LocationDomain.create(props);

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Location code is required');
      expect(result.errorCode).toBe('LOCATION_CODE_REQUIRED');
    });

    it('should fail if location code is whitespace only', () => {
      const props = { ...baseProps, locationCode: '   ' };
      const result = LocationDomain.create(props);

      expect(result.isFailure).toBe(true);
      expect(result.errorCode).toBe('LOCATION_CODE_REQUIRED');
    });

    it('should trim location code', () => {
      const props = { ...baseProps, locationCode: '  LOC-001  ' };
      const result = LocationDomain.create(props);

      expect(result.isSuccess).toBe(true);
      expect(result.value?.locationCode).toBe('LOC-001');
    });

    it('should accept valid location code', () => {
      const props = { ...baseProps, locationCode: 'WAREHOUSE-A' };
      const result = LocationDomain.create(props);

      expect(result.isSuccess).toBe(true);
      expect(result.value?.locationCode).toBe('WAREHOUSE-A');
    });
  });

  describe('create() - Invariant #2: Location name required', () => {
    it('should fail if location name is missing', () => {
      const props = { ...baseProps, locationName: '' };
      const result = LocationDomain.create(props);

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Location name is required');
      expect(result.errorCode).toBe('LOCATION_NAME_REQUIRED');
    });

    it('should fail if location name is whitespace only', () => {
      const props = { ...baseProps, locationName: '   ' };
      const result = LocationDomain.create(props);

      expect(result.isFailure).toBe(true);
      expect(result.errorCode).toBe('LOCATION_NAME_REQUIRED');
    });

    it('should trim location name', () => {
      const props = { ...baseProps, locationName: '  Main Warehouse  ' };
      const result = LocationDomain.create(props);

      expect(result.isSuccess).toBe(true);
      expect(result.value?.locationName).toBe('Main Warehouse');
    });
  });

  describe('create() - Invariant #3: Location type required', () => {
    it('should fail if location type is missing', () => {
      const props = { ...baseProps, locationType: undefined as any };
      const result = LocationDomain.create(props);

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Location type is required');
      expect(result.errorCode).toBe('LOCATION_TYPE_REQUIRED');
    });

    it('should accept WAREHOUSE type', () => {
      const props = { ...baseProps, locationType: 'WAREHOUSE' as const };
      const result = LocationDomain.create(props);

      expect(result.isSuccess).toBe(true);
      expect(result.value?.locationType).toBe('WAREHOUSE');
    });

    it('should accept STORE type', () => {
      const props = { ...baseProps, locationType: 'STORE' as const };
      const result = LocationDomain.create(props);

      expect(result.isSuccess).toBe(true);
      expect(result.value?.locationType).toBe('STORE');
    });

    it('should accept DISTRIBUTION_CENTER type', () => {
      const props = { ...baseProps, locationType: 'DISTRIBUTION_CENTER' as const };
      const result = LocationDomain.create(props);

      expect(result.isSuccess).toBe(true);
      expect(result.value?.locationType).toBe('DISTRIBUTION_CENTER');
    });

    it('should accept 3PL type', () => {
      const props = { ...baseProps, locationType: '3PL' as const };
      const result = LocationDomain.create(props);

      expect(result.isSuccess).toBe(true);
      expect(result.value?.locationType).toBe('3PL');
    });
  });

  describe('create() - Invariant #4: Cannot be parent of itself', () => {
    it('should create location without parent', () => {
      const props = { ...baseProps, parentLocationId: undefined };
      const result = LocationDomain.create(props);

      expect(result.isSuccess).toBe(true);
      expect(result.value?.parentLocationId).toBeNull();
    });

    it('should create location with valid parent', () => {
      const props = { ...baseProps, parentLocationId: 'parent-loc-1' };
      const result = LocationDomain.create(props);

      expect(result.isSuccess).toBe(true);
      expect(result.value?.parentLocationId).toBe('parent-loc-1');
    });

    it('should allow self-parent in create (validation at update)', () => {
      // Note: Self-parent check in create would require ID to be set first
      // Actual check happens in update() or validateHierarchy()
      const locationId = crypto.randomUUID();
      const props = {
        ...baseProps,
        id: locationId,
        parentLocationId: locationId,
      };
      const result = LocationDomain.create(props);

      // Create allows it (ID provided), but update() will catch it
      expect(result.isSuccess).toBe(true);
    });
  });

  describe('update() - Invariant #5: Cannot be self-parent', () => {
    let location: Location;

    beforeEach(() => {
      const createResult = LocationDomain.create(baseProps);
      location = createResult.value!;
    });

    it('should fail if trying to set self as parent', () => {
      const result = LocationDomain.update(location, {
        parentLocationId: location.id,
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Location cannot be its own parent');
      expect(result.errorCode).toBe('LOCATION_CANNOT_BE_SELF_PARENT');
    });

    it('should succeed with valid parent', () => {
      const result = LocationDomain.update(location, {
        parentLocationId: 'parent-loc-1',
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value?.parentLocationId).toBe('parent-loc-1');
    });

    it('should update location name', () => {
      const result = LocationDomain.update(location, {
        locationName: 'Updated Warehouse',
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value?.locationName).toBe('Updated Warehouse');
    });

    it('should fail if location name is empty', () => {
      const result = LocationDomain.update(location, {
        locationName: '',
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Location name cannot be empty');
      expect(result.errorCode).toBe('LOCATION_NAME_REQUIRED');
    });

    it('should trim updated location name', () => {
      const result = LocationDomain.update(location, {
        locationName: '  Updated Name  ',
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value?.locationName).toBe('Updated Name');
    });

    it('should preserve immutable fields', () => {
      const result = LocationDomain.update(location, {
        locationName: 'Updated',
      });

      expect(result.value?.tenantId).toBe(location.tenantId);
      expect(result.value?.locationCode).toBe(location.locationCode);
      expect(result.value?.createdAt).toEqual(location.createdAt);
    });

    it('should update updatedAt timestamp', () => {
      const originalUpdated = location.updatedAt;
      
      const result = LocationDomain.update(location, {
        locationName: 'Updated',
      });

      expect(result.value?.updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalUpdated.getTime()
      );
    });
  });

  describe('Address validation', () => {
    it('should accept valid address', () => {
      const props = {
        ...baseProps,
        addressJson: {
          street: '123 Main St',
          city: 'Springfield',
          state: 'IL',
          postalCode: '62701',
          country: 'USA',
        },
      };
      const result = LocationDomain.create(props);

      expect(result.isSuccess).toBe(true);
      expect(result.value?.addressJson).toEqual(props.addressJson);
    });

    it('should accept partial address', () => {
      const props = {
        ...baseProps,
        addressJson: {
          city: 'Springfield',
          country: 'USA',
        },
      };
      const result = LocationDomain.create(props);

      expect(result.isSuccess).toBe(true);
    });

    it('should fail if address has unknown keys', () => {
      const props = {
        ...baseProps,
        addressJson: {
          street: '123 Main St',
          invalidKey: 'Invalid',
        } as any,
      };
      const result = LocationDomain.create(props);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid address keys: invalidKey');
      expect(result.errorCode).toBe('LOCATION_ADDRESS_INVALID_KEYS');
    });

    it('should fail if address field is not string', () => {
      const props = {
        ...baseProps,
        addressJson: {
          street: '123 Main St',
          city: 12345,
        } as any,
      };
      const result = LocationDomain.create(props);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain("Address field 'city' must be a string");
      expect(result.errorCode).toBe('LOCATION_ADDRESS_FIELD_TYPE_INVALID');
    });

    it('should accept null address values', () => {
      const props = {
        ...baseProps,
        addressJson: {
          street: '123 Main St',
          city: null,
        } as any,
      };
      const result = LocationDomain.create(props);

      expect(result.isSuccess).toBe(true);
    });

    it('should accept empty address object', () => {
      const props = {
        ...baseProps,
        addressJson: {},
      };
      const result = LocationDomain.create(props);

      expect(result.isSuccess).toBe(true);
    });
  });

  describe('Status transitions', () => {
    let location: Location;

    beforeEach(() => {
      const createResult = LocationDomain.create(baseProps);
      location = createResult.value!;
    });

    it('should allow ACTIVE to INACTIVE transition', () => {
      expect(location.status).toBe('ACTIVE');

      const result = LocationDomain.canTransitionTo(location, 'INACTIVE');

      expect(result.isSuccess).toBe(true);
    });

    it('should allow ACTIVE to CLOSED transition', () => {
      const result = LocationDomain.canTransitionTo(location, 'CLOSED');

      expect(result.isSuccess).toBe(true);
    });

    it('should allow INACTIVE to ACTIVE transition', () => {
      const updateResult = LocationDomain.update(location, { status: 'INACTIVE' });
      const inactive = updateResult.value!;

      const result = LocationDomain.canTransitionTo(inactive, 'ACTIVE');

      expect(result.isSuccess).toBe(true);
    });

    it('should allow INACTIVE to CLOSED transition', () => {
      const updateResult = LocationDomain.update(location, { status: 'INACTIVE' });
      const inactive = updateResult.value!;

      const result = LocationDomain.canTransitionTo(inactive, 'CLOSED');

      expect(result.isSuccess).toBe(true);
    });

    it('should not allow CLOSED to any transition (terminal state)', () => {
      const updateResult = LocationDomain.update(location, { status: 'CLOSED' });
      const closed = updateResult.value!;

      const toActive = LocationDomain.canTransitionTo(closed, 'ACTIVE');
      const toInactive = LocationDomain.canTransitionTo(closed, 'INACTIVE');

      expect(toActive.isFailure).toBe(true);
      expect(toActive.errorCode).toBe('LOCATION_INVALID_TRANSITION');
      expect(toInactive.isFailure).toBe(true);
      expect(toInactive.errorCode).toBe('LOCATION_INVALID_TRANSITION');
    });

    it('should not allow same status transition', () => {
      const result = LocationDomain.canTransitionTo(location, 'ACTIVE');

      expect(result.isFailure).toBe(true);
    });
  });

  describe('canDeactivate()', () => {
    it('should allow deactivation of ACTIVE location', () => {
      const createResult = LocationDomain.create(baseProps);
      const location = createResult.value!;

      const result = LocationDomain.canDeactivate(location);

      expect(result.isSuccess).toBe(true);
    });

    it('should allow deactivation of INACTIVE location', () => {
      const createResult = LocationDomain.create({
        ...baseProps,
        status: 'INACTIVE',
      });
      const location = createResult.value!;

      const result = LocationDomain.canDeactivate(location);

      expect(result.isSuccess).toBe(true);
    });

    it('should fail to deactivate CLOSED location', () => {
      const createResult = LocationDomain.create({
        ...baseProps,
        status: 'CLOSED',
      });
      const location = createResult.value!;

      const result = LocationDomain.canDeactivate(location);

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Cannot deactivate closed location');
      expect(result.errorCode).toBe('LOCATION_ALREADY_CLOSED');
    });
  });

  describe('validateHierarchy() - Circular hierarchy prevention', () => {
    it('should fail if location is its own parent', () => {
      const locationId = 'loc-1';
      const result = LocationDomain.validateHierarchy(
        locationId,
        locationId,
        []
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Location cannot be its own parent');
      expect(result.errorCode).toBe('LOCATION_CANNOT_BE_SELF_PARENT');
    });

    it('should fail if proposed parent is a descendant', () => {
      const locationId = 'loc-1';
      const proposedParentId = 'loc-3';
      const descendants = ['loc-2', 'loc-3', 'loc-4']; // loc-3 is descendant

      const result = LocationDomain.validateHierarchy(
        locationId,
        proposedParentId,
        descendants
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('circular hierarchy');
      expect(result.errorCode).toBe('LOCATION_CIRCULAR_HIERARCHY');
    });

    it('should succeed if proposed parent is not a descendant', () => {
      const locationId = 'loc-1';
      const proposedParentId = 'loc-5';
      const descendants = ['loc-2', 'loc-3', 'loc-4'];

      const result = LocationDomain.validateHierarchy(
        locationId,
        proposedParentId,
        descendants
      );

      expect(result.isSuccess).toBe(true);
    });

    it('should succeed with no descendants', () => {
      const locationId = 'loc-1';
      const proposedParentId = 'loc-2';
      const descendants: string[] = [];

      const result = LocationDomain.validateHierarchy(
        locationId,
        proposedParentId,
        descendants
      );

      expect(result.isSuccess).toBe(true);
    });
  });

  describe('Query methods', () => {
    it('should correctly identify ACTIVE status', () => {
      const createResult = LocationDomain.create(baseProps);
      const location = createResult.value!;

      expect(LocationDomain.isActive(location)).toBe(true);
      expect(LocationDomain.isClosed(location)).toBe(false);
    });

    it('should correctly identify CLOSED status', () => {
      const createResult = LocationDomain.create({
        ...baseProps,
        status: 'CLOSED',
      });
      const location = createResult.value!;

      expect(LocationDomain.isActive(location)).toBe(false);
      expect(LocationDomain.isClosed(location)).toBe(true);
    });

    it('should correctly identify location with parent', () => {
      const createResult = LocationDomain.create({
        ...baseProps,
        parentLocationId: 'parent-1',
      });
      const location = createResult.value!;

      expect(LocationDomain.hasParent(location)).toBe(true);
    });

    it('should correctly identify location without parent', () => {
      const createResult = LocationDomain.create(baseProps);
      const location = createResult.value!;

      expect(LocationDomain.hasParent(location)).toBe(false);
    });
  });

  describe('getFormattedAddress() - Presentation helper', () => {
    it('should format complete address', () => {
      const createResult = LocationDomain.create({
        ...baseProps,
        addressJson: {
          street: '123 Main St',
          city: 'Springfield',
          state: 'IL',
          postalCode: '62701',
          country: 'USA',
        },
      });
      const location = createResult.value!;

      const formatted = LocationDomain.getFormattedAddress(location);

      expect(formatted).toBe('123 Main St, Springfield, IL, 62701, USA');
    });

    it('should format partial address', () => {
      const createResult = LocationDomain.create({
        ...baseProps,
        addressJson: {
          city: 'Springfield',
          country: 'USA',
        },
      });
      const location = createResult.value!;

      const formatted = LocationDomain.getFormattedAddress(location);

      expect(formatted).toBe('Springfield, USA');
    });

    it('should return null if no address', () => {
      const createResult = LocationDomain.create(baseProps);
      const location = createResult.value!;

      const formatted = LocationDomain.getFormattedAddress(location);

      expect(formatted).toBeNull();
    });

    it('should return null if address is empty object', () => {
      const createResult = LocationDomain.create({
        ...baseProps,
        addressJson: {},
      });
      const location = createResult.value!;

      const formatted = LocationDomain.getFormattedAddress(location);

      expect(formatted).toBeNull();
    });
  });

  describe('Tenant isolation', () => {
    it('should preserve tenant ID', () => {
      const props = {
        ...baseProps,
        tenantId: 'tenant-abc-123',
      };
      const result = LocationDomain.create(props);

      expect(result.isSuccess).toBe(true);
      expect(result.value?.tenantId).toBe('tenant-abc-123');
    });

    it('should preserve tenant ID through update', () => {
      const createResult = LocationDomain.create({
        ...baseProps,
        tenantId: 'tenant-xyz',
      });
      const location = createResult.value!;

      const updateResult = LocationDomain.update(location, {
        locationName: 'Updated',
      });

      expect(updateResult.value?.tenantId).toBe('tenant-xyz');
    });
  });

  describe('Boundary verification: Generic location (no Warehouse concepts)', () => {
    it('should NOT have Bin-related fields', () => {
      const createResult = LocationDomain.create(baseProps);
      const location = createResult.value!;

      // TypeScript compile-time check: these should not exist
      expect((location as any).binCode).toBeUndefined();
      expect((location as any).binCapacity).toBeUndefined();
      expect((location as any).zoneId).toBeUndefined();
      expect((location as any).aisleId).toBeUndefined();
      expect((location as any).rackId).toBeUndefined();
    });

    it('should NOT have Putaway-related fields', () => {
      const createResult = LocationDomain.create(baseProps);
      const location = createResult.value!;

      expect((location as any).putawayStrategy).toBeUndefined();
      expect((location as any).putawayPriority).toBeUndefined();
      expect((location as any).pickSequence).toBeUndefined();
    });

    it('should NOT have Warehouse-specific status values', () => {
      // Valid statuses are ACTIVE, INACTIVE, CLOSED (generic)
      // NOT: BIN_FULL, DAMAGED, NEEDS_PUTAWAY, etc.
      const createResult = LocationDomain.create({
        ...baseProps,
        status: 'ACTIVE',
      });

      expect(createResult.isSuccess).toBe(true);

      // TypeScript will prevent invalid status at compile time
      // This is runtime verification
      const validStatuses = ['ACTIVE', 'INACTIVE', 'CLOSED'];
      expect(validStatuses).toContain(createResult.value?.status);
    });

    it('should support generic location types (not warehouse-specific)', () => {
      const types = ['WAREHOUSE', 'STORE', 'DISTRIBUTION_CENTER', '3PL', 'VIRTUAL'];

      types.forEach(type => {
        const result = LocationDomain.create({
          ...baseProps,
          locationType: type as any,
        });

        expect(result.isSuccess).toBe(true);
      });
    });
  });

  describe('Edge cases and boundary values', () => {
    it('should handle very long location codes', () => {
      const longCode = 'A'.repeat(1000);
      const props = {
        ...baseProps,
        locationCode: longCode,
      };
      const result = LocationDomain.create(props);

      expect(result.isSuccess).toBe(true);
      expect(result.value?.locationCode).toBe(longCode);
    });

    it('should handle very long location names', () => {
      const longName = 'B'.repeat(1000);
      const props = {
        ...baseProps,
        locationName: longName,
      };
      const result = LocationDomain.create(props);

      expect(result.isSuccess).toBe(true);
      expect(result.value?.locationName).toBe(longName);
    });

    it('should set timestamps correctly', () => {
      const before = new Date();
      const result = LocationDomain.create(baseProps);
      const after = new Date();

      expect(result.isSuccess).toBe(true);
      const location = result.value!;
      
      expect(location.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(location.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(location.updatedAt).toEqual(location.createdAt);
    });

    it('should handle location with null parent explicitly', () => {
      const props = {
        ...baseProps,
        parentLocationId: null as any,
      };
      const result = LocationDomain.create(props);

      expect(result.isSuccess).toBe(true);
      expect(result.value?.parentLocationId).toBeNull();
    });
  });
});
