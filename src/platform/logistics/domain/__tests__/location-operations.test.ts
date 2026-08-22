/**
 * E7.2 Location Operational Tests
 * 
 * Tests E7.2 operational state machine extensions:
 * - deactivateOperation(): ACTIVE → INACTIVE
 * - closeOperation(): ACTIVE/INACTIVE → CLOSED
 * - reactivateOperation(): INACTIVE → ACTIVE
 * 
 * Design Constraints:
 * - DO NOT modify E7.1 frozen Location domain
 * - DO NOT introduce Warehouse/Product concepts (bins, putaway, etc.)
 * - Operational semantics only (state machine + context)
 * - Negative-path integrity (failures leave state unchanged)
 */

import { LocationDomain } from '../location.domain';
import type { Location, CreateLocationProps } from '../location.types';

describe('E7.2 Location Operations', () => {
  const tenantId = 'tenant-ops-1';

  function createTestLocation(overrides?: Partial<CreateLocationProps>): Location {
    const props: CreateLocationProps = {
      tenantId,
      locationCode: 'LOC-OPS-001',
      locationName: 'Test Location',
      locationType: 'WAREHOUSE',
      ...overrides,
    };

    const result = LocationDomain.create(props);
    if (result.isFailure) {
      throw new Error(`Failed to create test location: ${result.error}`);
    }

    return result.value!;
  }

  describe('deactivateOperation() - ACTIVE → INACTIVE', () => {
    it('should deactivate ACTIVE location with reason', () => {
      const location = createTestLocation({ status: 'ACTIVE' });

      const result = LocationDomain.deactivateOperation(location, {
        reason: 'Temporary maintenance',
        deactivatedBy: 'user-1',
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value!.status).toBe('INACTIVE');
      expect(result.value!.locationCode).toBe(location.locationCode);
      expect(result.value!.locationName).toBe(location.locationName);
    });

    it('should reject deactivating INACTIVE location', () => {
      const location = createTestLocation({ status: 'INACTIVE' });

      const result = LocationDomain.deactivateOperation(location, {
        reason: 'Maintenance',
        deactivatedBy: 'user-1',
      });

      expect(result.isFailure).toBe(true);
      expect(result.errorCode).toBe('LOCATION_INVALID_TRANSITION');
      // State unchanged
      expect(location.status).toBe('INACTIVE');
    });

    it('should reject deactivating CLOSED location', () => {
      const location = createTestLocation({ status: 'CLOSED' });

      const result = LocationDomain.deactivateOperation(location, {
        reason: 'Maintenance',
        deactivatedBy: 'user-1',
      });

      expect(result.isFailure).toBe(true);
      expect(result.errorCode).toBe('LOCATION_ALREADY_CLOSED');
      // State unchanged
      expect(location.status).toBe('CLOSED');
    });

    it('should require reason', () => {
      const location = createTestLocation({ status: 'ACTIVE' });

      const result = LocationDomain.deactivateOperation(location, {
        reason: '',
        deactivatedBy: 'user-1',
      });

      expect(result.isFailure).toBe(true);
      expect(result.errorCode).toBe('DEACTIVATION_REASON_REQUIRED');
      // State unchanged
      expect(location.status).toBe('ACTIVE');
    });

    it('should require deactivatedBy', () => {
      const location = createTestLocation({ status: 'ACTIVE' });

      const result = LocationDomain.deactivateOperation(location, {
        reason: 'Maintenance',
        deactivatedBy: '',
      });

      expect(result.isFailure).toBe(true);
      expect(result.errorCode).toBe('DEACTIVATED_BY_REQUIRED');
      // State unchanged
      expect(location.status).toBe('ACTIVE');
    });
  });

  describe('closeOperation() - ACTIVE/INACTIVE → CLOSED', () => {
    it('should close ACTIVE location with reason', () => {
      const location = createTestLocation({ status: 'ACTIVE' });

      const result = LocationDomain.closeOperation(location, {
        reason: 'Facility permanently closed',
        closedBy: 'admin-1',
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value!.status).toBe('CLOSED');
    });

    it('should close INACTIVE location with reason', () => {
      const location = createTestLocation({ status: 'INACTIVE' });

      const result = LocationDomain.closeOperation(location, {
        reason: 'Decommissioned',
        closedBy: 'admin-1',
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value!.status).toBe('CLOSED');
    });

    it('should reject closing already CLOSED location', () => {
      const location = createTestLocation({ status: 'CLOSED' });

      const result = LocationDomain.closeOperation(location, {
        reason: 'Decommissioned',
        closedBy: 'admin-1',
      });

      expect(result.isFailure).toBe(true);
      expect(result.errorCode).toBe('LOCATION_INVALID_TRANSITION');
      // State unchanged
      expect(location.status).toBe('CLOSED');
    });

    it('should require reason', () => {
      const location = createTestLocation({ status: 'ACTIVE' });

      const result = LocationDomain.closeOperation(location, {
        reason: '',
        closedBy: 'admin-1',
      });

      expect(result.isFailure).toBe(true);
      expect(result.errorCode).toBe('CLOSE_REASON_REQUIRED');
      // State unchanged
      expect(location.status).toBe('ACTIVE');
    });

    it('should require closedBy', () => {
      const location = createTestLocation({ status: 'ACTIVE' });

      const result = LocationDomain.closeOperation(location, {
        reason: 'Decommissioned',
        closedBy: '',
      });

      expect(result.isFailure).toBe(true);
      expect(result.errorCode).toBe('CLOSED_BY_REQUIRED');
      // State unchanged
      expect(location.status).toBe('ACTIVE');
    });
  });

  describe('reactivateOperation() - INACTIVE → ACTIVE', () => {
    it('should reactivate INACTIVE location with reason', () => {
      const location = createTestLocation({ status: 'INACTIVE' });

      const result = LocationDomain.reactivateOperation(location, {
        reason: 'Maintenance complete',
        reactivatedBy: 'user-1',
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value!.status).toBe('ACTIVE');
    });

    it('should reject reactivating ACTIVE location', () => {
      const location = createTestLocation({ status: 'ACTIVE' });

      const result = LocationDomain.reactivateOperation(location, {
        reason: 'Reactivate',
        reactivatedBy: 'user-1',
      });

      expect(result.isFailure).toBe(true);
      expect(result.errorCode).toBe('LOCATION_INVALID_TRANSITION');
      // State unchanged
      expect(location.status).toBe('ACTIVE');
    });

    it('should reject reactivating CLOSED location', () => {
      const location = createTestLocation({ status: 'CLOSED' });

      const result = LocationDomain.reactivateOperation(location, {
        reason: 'Reopen facility',
        reactivatedBy: 'admin-1',
      });

      expect(result.isFailure).toBe(true);
      expect(result.errorCode).toBe('LOCATION_INVALID_TRANSITION');
      // State unchanged
      expect(location.status).toBe('CLOSED');
    });

    it('should require reason', () => {
      const location = createTestLocation({ status: 'INACTIVE' });

      const result = LocationDomain.reactivateOperation(location, {
        reason: '',
        reactivatedBy: 'user-1',
      });

      expect(result.isFailure).toBe(true);
      expect(result.errorCode).toBe('REACTIVATION_REASON_REQUIRED');
      // State unchanged
      expect(location.status).toBe('INACTIVE');
    });

    it('should require reactivatedBy', () => {
      const location = createTestLocation({ status: 'INACTIVE' });

      const result = LocationDomain.reactivateOperation(location, {
        reason: 'Back online',
        reactivatedBy: '',
      });

      expect(result.isFailure).toBe(true);
      expect(result.errorCode).toBe('REACTIVATED_BY_REQUIRED');
      // State unchanged
      expect(location.status).toBe('INACTIVE');
    });
  });

  describe('Negative-Path Integrity', () => {
    it('should not mutate location on deactivation failure', () => {
      const location = createTestLocation({ status: 'CLOSED' });
      const originalStatus = location.status;
      const originalCode = location.locationCode;

      const result = LocationDomain.deactivateOperation(location, {
        reason: 'Test',
        deactivatedBy: 'user-1',
      });

      expect(result.isFailure).toBe(true);
      expect(location.status).toBe(originalStatus);
      expect(location.locationCode).toBe(originalCode);
    });

    it('should not mutate location on close failure', () => {
      const location = createTestLocation({ status: 'CLOSED' });
      const originalStatus = location.status;

      const result = LocationDomain.closeOperation(location, {
        reason: 'Test',
        closedBy: 'admin-1',
      });

      expect(result.isFailure).toBe(true);
      expect(location.status).toBe(originalStatus);
    });

    it('should not mutate location on reactivation failure', () => {
      const location = createTestLocation({ status: 'CLOSED' });
      const originalStatus = location.status;

      const result = LocationDomain.reactivateOperation(location, {
        reason: 'Test',
        reactivatedBy: 'user-1',
      });

      expect(result.isFailure).toBe(true);
      expect(location.status).toBe(originalStatus);
    });
  });

  describe('E7.1 Boundary Preservation', () => {
    it('should not modify E7.1 canTransitionTo() behavior', () => {
      const location = createTestLocation({ status: 'ACTIVE' });

      // E7.1 frozen contract
      const result = LocationDomain.canTransitionTo(location, 'INACTIVE');

      expect(result.isSuccess).toBe(true);
    });

    it('should preserve E7.1 create() contract', () => {
      const props: CreateLocationProps = {
        tenantId,
        locationCode: 'E71-001',
        locationName: 'E7.1 Test',
        locationType: 'WAREHOUSE',
      };

      const result = LocationDomain.create(props);

      expect(result.isSuccess).toBe(true);
      expect(result.value!.status).toBe('ACTIVE'); // E7.1 default
    });

    it('should use E7.1 canTransitionTo() for validation', () => {
      const location = createTestLocation({ status: 'CLOSED' });

      // Attempt invalid transition via E7.2 operation
      const result = LocationDomain.reactivateOperation(location, {
        reason: 'Test',
        reactivatedBy: 'user-1',
      });

      // Should fail via E7.1 validation
      expect(result.isFailure).toBe(true);
      expect(result.errorCode).toBe('LOCATION_INVALID_TRANSITION');
    });
  });
});
