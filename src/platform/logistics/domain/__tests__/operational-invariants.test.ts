/**
 * E7.2 Operational Invariants Tests
 * 
 * Verifies that domain operations enforce operational constraints:
 * - Quantity constraints (positive, not exceeding available)
 * - Status-based preconditions
 * - Atomic failure (state unchanged on rejection)
 * - Typed errors for all failure modes
 * 
 * Focus: Can OS prevent dangerous operations?
 * 
 * Design Principle:
 * - If E7.1 already enforces an invariant → test it works
 * - If E7.2 discovers missing invariant → implement in E7.2 layer
 * - DO NOT modify E7.1 frozen code
 */

import { InventoryDomain } from '../inventory.domain';
import { LocationDomain } from '../location.domain';
import type { Inventory, CreateInventoryProps, Location, CreateLocationProps } from '../inventory.types';

describe('E7.2 Operational Invariants', () => {
  const tenantId = 'tenant-inv-1';

  function createTestInventory(overrides?: Partial<CreateInventoryProps>): Inventory {
    const props: CreateInventoryProps = {
      tenantId,
      itemId: 'item-1',
      locationId: 'loc-1',
      quantityOnHand: 100,
      quantityReserved: 0,
      uomId: 'uom-1',
      lotNumber: 'LOT-001',
      ...overrides,
    };

    const result = InventoryDomain.create(props);
    if (result.isFailure) {
      throw new Error(`Failed to create test inventory: ${result.error}`);
    }

    return result.value!;
  }

  function createTestLocation(overrides?: Partial<CreateLocationProps>): Location {
    const props: CreateLocationProps = {
      tenantId,
      locationCode: 'LOC-001',
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

  describe('Invariant #1: Reserve quantity must be positive', () => {
    it('should reject zero quantity reservation', () => {
      const inventory = createTestInventory();

      const result = InventoryDomain.reserveOperation(inventory, 0, {
        reason: 'Test',
        requestedBy: 'user-1',
      });

      expect(result.isFailure).toBe(true);
      expect(result.errorCode).toBe('INVENTORY_RESERVE_QUANTITY_INVALID');
      // State unchanged
      expect(inventory.quantityReserved).toBe(0);
      expect(inventory.quantityOnHand).toBe(100);
    });

    it('should reject negative quantity reservation', () => {
      const inventory = createTestInventory();

      const result = InventoryDomain.reserveOperation(inventory, -10, {
        reason: 'Test',
        requestedBy: 'user-1',
      });

      expect(result.isFailure).toBe(true);
      expect(result.errorCode).toBe('INVENTORY_RESERVE_QUANTITY_INVALID');
      // State unchanged
      expect(inventory.quantityReserved).toBe(0);
    });
  });

  describe('Invariant #2: Reserve quantity cannot exceed available', () => {
    it('should reject reservation exceeding available quantity', () => {
      const inventory = createTestInventory({
        quantityOnHand: 50,
        quantityReserved: 0,
      });

      const result = InventoryDomain.reserveOperation(inventory, 100, {
        reason: 'Over-reserve',
        requestedBy: 'user-1',
      });

      expect(result.isFailure).toBe(true);
      expect(result.errorCode).toBe('INVENTORY_INSUFFICIENT_QUANTITY');
      // State unchanged
      expect(inventory.quantityReserved).toBe(0);
      expect(inventory.quantityOnHand).toBe(50);
    });

    it('should reject reservation when available is zero', () => {
      const inventory = createTestInventory({
        quantityOnHand: 50,
        quantityReserved: 50, // all reserved
      });

      const result = InventoryDomain.reserveOperation(inventory, 1, {
        reason: 'Reserve from empty',
        requestedBy: 'user-1',
      });

      expect(result.isFailure).toBe(true);
      expect(result.errorCode).toBe('INVENTORY_INSUFFICIENT_QUANTITY');
      // State unchanged
      expect(inventory.quantityReserved).toBe(50);
    });

    it('should calculate available correctly (onHand - reserved)', () => {
      const inventory = createTestInventory({
        quantityOnHand: 100,
        quantityReserved: 30,
      });

      // Available = 70
      // Request 71 → fail
      const result = InventoryDomain.reserveOperation(inventory, 71, {
        reason: 'Test boundary',
        requestedBy: 'user-1',
      });

      expect(result.isFailure).toBe(true);
      expect(result.errorCode).toBe('INVENTORY_INSUFFICIENT_QUANTITY');
      // State unchanged
      expect(inventory.quantityReserved).toBe(30);
    });

    it('should allow reservation exactly equal to available', () => {
      const inventory = createTestInventory({
        quantityOnHand: 100,
        quantityReserved: 30,
      });

      // Available = 70
      // Request 70 → success
      const result = InventoryDomain.reserveOperation(inventory, 70, {
        reason: 'Reserve all available',
        requestedBy: 'user-1',
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value!.quantityReserved).toBe(100);
    });
  });

  describe('Invariant #3: Cancel quantity cannot exceed reserved', () => {
    it('should reject cancel exceeding reserved quantity', () => {
      const inventory = createTestInventory({
        quantityOnHand: 100,
        quantityReserved: 30,
        status: 'RESERVED',
      });

      const result = InventoryDomain.cancelOperation(inventory, 50, {
        reason: 'Over-cancel',
        cancelledBy: 'user-1',
      });

      expect(result.isFailure).toBe(true);
      expect(result.errorCode).toBe('INVENTORY_CANCEL_EXCEEDS_RESERVED');
      // State unchanged
      expect(inventory.quantityReserved).toBe(30);
      expect(inventory.status).toBe('RESERVED');
    });

    it('should reject cancel when reserved is zero', () => {
      const inventory = createTestInventory({
        quantityOnHand: 100,
        quantityReserved: 0,
        status: 'AVAILABLE',
      });

      const result = InventoryDomain.cancelOperation(inventory, 10, {
        reason: 'Cancel nothing',
        cancelledBy: 'user-1',
      });

      expect(result.isFailure).toBe(true);
      expect(result.errorCode).toBe('INVENTORY_CANCEL_EXCEEDS_RESERVED');
      // State unchanged
      expect(inventory.status).toBe('AVAILABLE');
    });

    it('should allow cancel exactly equal to reserved', () => {
      const inventory = createTestInventory({
        quantityOnHand: 100,
        quantityReserved: 30,
        status: 'RESERVED',
      });

      const result = InventoryDomain.cancelOperation(inventory, 30, {
        reason: 'Cancel all',
        cancelledBy: 'user-1',
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value!.quantityReserved).toBe(0);
      expect(result.value!.status).toBe('AVAILABLE');
    });
  });

  describe('Invariant #4: Operations must validate status preconditions', () => {
    it('should reject shipOperation on AVAILABLE inventory', () => {
      const inventory = createTestInventory({
        status: 'AVAILABLE',
        quantityReserved: 0,
      });

      const result = InventoryDomain.shipOperation(inventory, {
        shippedBy: 'user-1',
        shippedAt: new Date(),
      });

      expect(result.isFailure).toBe(true);
      expect(result.errorCode).toBe('INVENTORY_INVALID_STATUS_FOR_SHIP');
      // State unchanged
      expect(inventory.status).toBe('AVAILABLE');
    });

    it('should reject expireOperation on AVAILABLE inventory', () => {
      const inventory = createTestInventory({
        status: 'AVAILABLE',
      });

      const result = InventoryDomain.expireOperation(inventory, {
        reason: 'Past expiration date',
        expiredBy: 'system',
      });

      expect(result.isFailure).toBe(true);
      expect(result.errorCode).toBe('INVENTORY_INVALID_STATUS_FOR_EXPIRE');
      // State unchanged
      expect(inventory.status).toBe('AVAILABLE');
    });

    it('should reject cancelOperation on EXPIRED inventory', () => {
      const inventory = createTestInventory({
        status: 'EXPIRED',
        quantityReserved: 10,
      });

      const result = InventoryDomain.cancelOperation(inventory, 10, {
        reason: 'Cancel expired',
        cancelledBy: 'user-1',
      });

      expect(result.isFailure).toBe(true);
      expect(result.errorCode).toBe('INVENTORY_INVALID_STATUS_FOR_CANCEL');
      // State unchanged
      expect(inventory.status).toBe('EXPIRED');
      expect(inventory.quantityReserved).toBe(10);
    });
  });

  describe('Invariant #5: Location operations require reason and actor', () => {
    it('should reject deactivation without reason', () => {
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

    it('should reject close without actor', () => {
      const location = createTestLocation({ status: 'ACTIVE' });

      const result = LocationDomain.closeOperation(location, {
        reason: 'Close facility',
        closedBy: '',
      });

      expect(result.isFailure).toBe(true);
      expect(result.errorCode).toBe('CLOSED_BY_REQUIRED');
      // State unchanged
      expect(location.status).toBe('ACTIVE');
    });
  });

  describe('Invariant #6: Atomic failure (no partial mutation)', () => {
    it('should not mutate inventory on quantity validation failure', () => {
      const inventory = createTestInventory({
        quantityOnHand: 50,
        quantityReserved: 0,
      });

      const originalOnHand = inventory.quantityOnHand;
      const originalReserved = inventory.quantityReserved;
      const originalStatus = inventory.status;

      // Attempt over-reservation
      const result = InventoryDomain.reserveOperation(inventory, 100, {
        reason: 'Test',
        requestedBy: 'user-1',
      });

      expect(result.isFailure).toBe(true);
      // Verify NO mutation occurred
      expect(inventory.quantityOnHand).toBe(originalOnHand);
      expect(inventory.quantityReserved).toBe(originalReserved);
      expect(inventory.status).toBe(originalStatus);
    });

    it('should not mutate inventory on status transition failure', () => {
      const inventory = createTestInventory({
        status: 'AVAILABLE',
        quantityOnHand: 100,
        quantityReserved: 0,
      });

      const originalStatus = inventory.status;
      const originalQuantities = {
        onHand: inventory.quantityOnHand,
        reserved: inventory.quantityReserved,
      };

      // Attempt invalid ship (not reserved)
      const result = InventoryDomain.shipOperation(inventory, {
        shippedBy: 'user-1',
        shippedAt: new Date(),
      });

      expect(result.isFailure).toBe(true);
      // Verify NO mutation
      expect(inventory.status).toBe(originalStatus);
      expect(inventory.quantityOnHand).toBe(originalQuantities.onHand);
      expect(inventory.quantityReserved).toBe(originalQuantities.reserved);
    });

    it('should not mutate location on invalid transition', () => {
      const location = createTestLocation({ status: 'CLOSED' });

      const originalStatus = location.status;
      const originalCode = location.locationCode;

      // Attempt invalid reactivation (CLOSED → ACTIVE not allowed)
      const result = LocationDomain.reactivateOperation(location, {
        reason: 'Reopen',
        reactivatedBy: 'admin',
      });

      expect(result.isFailure).toBe(true);
      // Verify NO mutation
      expect(location.status).toBe(originalStatus);
      expect(location.locationCode).toBe(originalCode);
    });
  });

  describe('Invariant #7: Typed errors for all failure modes', () => {
    it('should return typed error for quantity violations', () => {
      const inventory = createTestInventory();

      const result = InventoryDomain.reserveOperation(inventory, -1, {
        reason: 'Test',
        requestedBy: 'user-1',
      });

      expect(result.isFailure).toBe(true);
      expect(result.errorCode).toBeDefined();
      expect(result.errorCode).toBe('INVENTORY_RESERVE_QUANTITY_INVALID');
      expect(result.error).toBeDefined();
    });

    it('should return typed error for status violations', () => {
      const inventory = createTestInventory({ status: 'EXPIRED' });

      const result = InventoryDomain.reserveOperation(inventory, 10, {
        reason: 'Test',
        requestedBy: 'user-1',
      });

      expect(result.isFailure).toBe(true);
      expect(result.errorCode).toBeDefined();
      expect(result.errorCode).toBe('INVENTORY_INVALID_STATUS_FOR_RESERVE');
    });

    it('should return typed error for missing context', () => {
      const inventory = createTestInventory();

      const result = InventoryDomain.reserveOperation(inventory, 10, {
        reason: '',
        requestedBy: 'user-1',
      });

      expect(result.isFailure).toBe(true);
      expect(result.errorCode).toBeDefined();
      expect(result.errorCode).toBe('RESERVE_REASON_REQUIRED');
    });
  });
});
