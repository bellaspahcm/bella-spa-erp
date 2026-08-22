/**
 * E7.2 Operational Kernel Tests — Inventory State Machine
 * 
 * Tests operational methods: reserveOperation(), shipOperation(), cancelOperation(), expireOperation()
 * 
 * Focus:
 * - Valid state transitions
 * - Operational invariants enforcement
 * - NEGATIVE-PATH INTEGRITY (invalid operations leave state unchanged)
 */

import { InventoryDomain } from '../inventory.domain';
import type { Inventory } from '../inventory.types';

describe('E7.2 Inventory Operations', () => {
  const baseProps = {
    tenantId: 'tenant-1',
    itemId: 'item-1',
    locationId: 'loc-1',
    locationType: 'WAREHOUSE' as const,
  };

  describe('reserveOperation() - AVAILABLE to RESERVED', () => {
    describe('Valid operations', () => {
      it('should reserve available inventory', () => {
        const inventory = InventoryDomain.create({
          ...baseProps,
          quantityOnHand: 100,
          status: 'AVAILABLE',
        }).value!;

        const result = InventoryDomain.reserveOperation(
          inventory,
          10,
          { reason: 'Sale order', requestedBy: 'user-1' }
        );

        expect(result.isSuccess).toBe(true);
        expect(result.value!.quantityReserved).toBe(10);
        expect(result.value!.quantityAvailable).toBe(90);
        expect(result.value!.status).toBe('AVAILABLE');
      });

      it('should transition to RESERVED when fully reserved', () => {
        const inventory = InventoryDomain.create({
          ...baseProps,
          quantityOnHand: 100,
          status: 'AVAILABLE',
        }).value!;

        const result = InventoryDomain.reserveOperation(
          inventory,
          100,
          { reason: 'Sale order', requestedBy: 'user-1' }
        );

        expect(result.isSuccess).toBe(true);
        expect(result.value!.quantityReserved).toBe(100);
        expect(result.value!.quantityAvailable).toBe(0);
        expect(result.value!.status).toBe('RESERVED');
      });
    });

    describe('Invalid operations - NEGATIVE-PATH INTEGRITY', () => {
      it('should reject reservation of insufficient quantity', () => {
        const inventory = InventoryDomain.create({
          ...baseProps,
          quantityOnHand: 100,
          quantityReserved: 0,
          status: 'AVAILABLE',
        }).value!;

        const result = InventoryDomain.reserveOperation(
          inventory,
          150,
          { reason: 'Sale order', requestedBy: 'user-1' }
        );

        expect(result.isFailure).toBe(true);
        expect(result.errorCode).toBe('INVENTORY_INSUFFICIENT_QUANTITY');
      });

      it('should NOT mutate state when reservation fails', () => {
        const inventory = InventoryDomain.create({
          ...baseProps,
          quantityOnHand: 50,
          status: 'AVAILABLE',
        }).value!;

        const originalReserved = inventory.quantityReserved;
        const originalAvailable = inventory.quantityAvailable;

        const result = InventoryDomain.reserveOperation(
          inventory,
          100,
          { reason: 'Sale order', requestedBy: 'user-1' }
        );

        expect(result.isFailure).toBe(true);
        expect(inventory.quantityReserved).toBe(originalReserved);
        expect(inventory.quantityAvailable).toBe(originalAvailable);
      });

      it('should reject reservation of EXPIRED inventory', () => {
        const expiredInventory = InventoryDomain.create({
          ...baseProps,
          quantityOnHand: 100,
          status: 'EXPIRED',
        }).value!;

        const result = InventoryDomain.reserveOperation(
          expiredInventory,
          10,
          { reason: 'Sale order', requestedBy: 'user-1' }
        );

        expect(result.isFailure).toBe(true);
        expect(result.errorCode).toBe('INVENTORY_INVALID_STATUS_FOR_RESERVE');
      });
    });
  });

  describe('shipOperation() - RESERVED to TRANSIT', () => {
    describe('Valid operations', () => {
      it('should ship reserved inventory', () => {
        const inventory = InventoryDomain.create({
          ...baseProps,
          quantityOnHand: 100,
          quantityReserved: 100,
          status: 'RESERVED',
        }).value!;

        const result = InventoryDomain.shipOperation(inventory);

        expect(result.isSuccess).toBe(true);
        expect(result.value!.status).toBe('TRANSIT');
      });
    });

    describe('Invalid operations - NEGATIVE-PATH INTEGRITY', () => {
      it('should reject shipping AVAILABLE inventory', () => {
        const inventory = InventoryDomain.create({
          ...baseProps,
          quantityOnHand: 100,
          status: 'AVAILABLE',
        }).value!;

        const result = InventoryDomain.shipOperation(inventory);

        expect(result.isFailure).toBe(true);
        expect(result.errorCode).toBe('INVENTORY_INVALID_STATUS_FOR_SHIP');
      });

      it('should NOT mutate state when ship fails', () => {
        const inventory = InventoryDomain.create({
          ...baseProps,
          quantityOnHand: 100,
          status: 'AVAILABLE',
        }).value!;

        const originalStatus = inventory.status;

        const result = InventoryDomain.shipOperation(inventory);

        expect(result.isFailure).toBe(true);
        expect(inventory.status).toBe(originalStatus);
      });
    });
  });

  describe('cancelOperation() - Release reservation', () => {
    describe('Valid operations', () => {
      it('should cancel partial reservation', () => {
        const inventory = InventoryDomain.create({
          ...baseProps,
          quantityOnHand: 100,
          quantityReserved: 50,
          status: 'AVAILABLE',
        }).value!;

        const result = InventoryDomain.cancelOperation(inventory, 20, 'Order cancelled');

        expect(result.isSuccess).toBe(true);
        expect(result.value!.quantityReserved).toBe(30);
        expect(result.value!.quantityAvailable).toBe(70);
      });

      it('should transition RESERVED to AVAILABLE when all reservations cancelled', () => {
        const inventory = InventoryDomain.create({
          ...baseProps,
          quantityOnHand: 100,
          quantityReserved: 100,
          status: 'RESERVED',
        }).value!;

        const result = InventoryDomain.cancelOperation(inventory, 100, 'Order cancelled');

        expect(result.isSuccess).toBe(true);
        expect(result.value!.quantityReserved).toBe(0);
        expect(result.value!.quantityAvailable).toBe(100);
        expect(result.value!.status).toBe('AVAILABLE');
      });
    });

    describe('Invalid operations - NEGATIVE-PATH INTEGRITY', () => {
      it('should reject cancel exceeding reserved quantity', () => {
        const inventory = InventoryDomain.create({
          ...baseProps,
          quantityOnHand: 100,
          quantityReserved: 30,
          status: 'AVAILABLE',
        }).value!;

        const result = InventoryDomain.cancelOperation(inventory, 50, 'Order cancelled');

        expect(result.isFailure).toBe(true);
        expect(result.errorCode).toBe('INVENTORY_CANCEL_EXCEEDS_RESERVED');
      });

      it('should NOT mutate state when cancel fails', () => {
        const inventory = InventoryDomain.create({
          ...baseProps,
          quantityOnHand: 100,
          quantityReserved: 30,
          status: 'AVAILABLE',
        }).value!;

        const originalReserved = inventory.quantityReserved;

        const result = InventoryDomain.cancelOperation(inventory, 50, 'Order cancelled');

        expect(result.isFailure).toBe(true);
        expect(inventory.quantityReserved).toBe(originalReserved);
      });
    });
  });

  describe('expireOperation() - QUARANTINE to EXPIRED', () => {
    describe('Valid operations', () => {
      it('should expire quarantine inventory', () => {
        const inventory = InventoryDomain.create({
          ...baseProps,
          quantityOnHand: 100,
          quantityReserved: 0,
          status: 'QUARANTINE',
        }).value!;

        const result = InventoryDomain.expireOperation(inventory);

        expect(result.isSuccess).toBe(true);
        expect(result.value!.status).toBe('EXPIRED');
        expect(result.value!.quantityAvailable).toBe(0);
      });
    });

    describe('Invalid operations - NEGATIVE-PATH INTEGRITY', () => {
      it('should reject expiring AVAILABLE inventory', () => {
        const inventory = InventoryDomain.create({
          ...baseProps,
          quantityOnHand: 100,
          status: 'AVAILABLE',
        }).value!;

        const result = InventoryDomain.expireOperation(inventory);

        expect(result.isFailure).toBe(true);
        expect(result.errorCode).toBe('INVENTORY_INVALID_STATUS_FOR_EXPIRE');
      });

      it('should reject expiring inventory with reserved quantity', () => {
        const inventory = InventoryDomain.create({
          ...baseProps,
          quantityOnHand: 100,
          quantityReserved: 10,
          status: 'QUARANTINE',
        }).value!;

        const result = InventoryDomain.expireOperation(inventory);

        expect(result.isFailure).toBe(true);
        expect(result.errorCode).toBe('INVENTORY_HAS_RESERVED_QUANTITY');
      });

      it('should NOT mutate state when expire fails', () => {
        const inventory = InventoryDomain.create({
          ...baseProps,
          quantityOnHand: 100,
          status: 'AVAILABLE',
        }).value!;

        const originalStatus = inventory.status;

        const result = InventoryDomain.expireOperation(inventory);

        expect(result.isFailure).toBe(true);
        expect(inventory.status).toBe(originalStatus);
      });
    });
  });

  describe('Invariant preservation across operations', () => {
    it('should maintain reserved + available = on_hand', () => {
      let inventory = InventoryDomain.create({
        ...baseProps,
        quantityOnHand: 100,
        status: 'AVAILABLE',
      }).value!;

      inventory = InventoryDomain.reserveOperation(
        inventory,
        30,
        { reason: 'Order 1', requestedBy: 'user-1' }
      ).value!;
      expect(inventory.quantityReserved + inventory.quantityAvailable).toBe(100);

      inventory = InventoryDomain.cancelOperation(inventory, 10, 'Order cancelled').value!;
      expect(inventory.quantityReserved + inventory.quantityAvailable).toBe(100);
    });
  });
});
