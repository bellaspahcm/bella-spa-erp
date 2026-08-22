/**
 * Inventory Domain Tests
 * 
 * E7.1.6.2: Inventory domain kernel verification
 * 
 * Coverage: 7 invariants
 * 1. Quantity on hand >= 0
 * 2. Quantity reserved >= 0
 * 3. Quantity reserved <= quantity on hand
 * 4. Available = on hand - reserved (computed)
 * 5. Serial number requires lot number
 * 6. Status transitions validated
 * 7. Cannot mark DAMAGED/EXPIRED with reservations
 * 
 * Pure unit tests (no database, no HTTP, no infrastructure).
 */

import { InventoryDomain } from '../inventory.domain';
import type { CreateInventoryProps, Inventory } from '../inventory.types';

describe('InventoryDomain', () => {
  // Helper: valid inventory props
  const validInventoryProps: CreateInventoryProps = {
    tenantId: 'tenant-1',
    itemId: 'item-1',
    locationId: 'loc-1',
    locationType: 'WAREHOUSE',
    quantityOnHand: 100,
  };

  describe('create()', () => {
    describe('Invariant 1: Quantity on hand >= 0', () => {
      it('succeeds with positive quantity', () => {
        const result = InventoryDomain.create({
          ...validInventoryProps,
          quantityOnHand: 50,
        });
        
        expect(result.isSuccess).toBe(true);
        expect(result.value?.quantityOnHand).toBe(50);
      });

      it('succeeds with zero quantity', () => {
        const result = InventoryDomain.create({
          ...validInventoryProps,
          quantityOnHand: 0,
        });
        
        expect(result.isSuccess).toBe(true);
        expect(result.value?.quantityOnHand).toBe(0);
      });

      it('fails with negative quantity', () => {
        const result = InventoryDomain.create({
          ...validInventoryProps,
          quantityOnHand: -10,
        });
        
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('Quantity on hand cannot be negative');
        expect(result.errorCode).toBe('INVENTORY_QUANTITY_ON_HAND_NEGATIVE');
      });
    });

    describe('Invariant 2: Quantity reserved >= 0', () => {
      it('succeeds with positive reserved', () => {
        const result = InventoryDomain.create({
          ...validInventoryProps,
          quantityOnHand: 100,
          quantityReserved: 25,
        });
        
        expect(result.isSuccess).toBe(true);
        expect(result.value?.quantityReserved).toBe(25);
      });

      it('succeeds with zero reserved (default)', () => {
        const result = InventoryDomain.create(validInventoryProps);
        
        expect(result.isSuccess).toBe(true);
        expect(result.value?.quantityReserved).toBe(0);
      });

      it('fails with negative reserved', () => {
        const result = InventoryDomain.create({
          ...validInventoryProps,
          quantityReserved: -5,
        });
        
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('Quantity reserved cannot be negative');
        expect(result.errorCode).toBe('INVENTORY_QUANTITY_RESERVED_NEGATIVE');
      });
    });

    describe('Invariant 3: Quantity reserved <= quantity on hand', () => {
      it('succeeds when reserved equals on hand', () => {
        const result = InventoryDomain.create({
          ...validInventoryProps,
          quantityOnHand: 100,
          quantityReserved: 100,
        });
        
        expect(result.isSuccess).toBe(true);
        expect(result.value?.quantityOnHand).toBe(100);
        expect(result.value?.quantityReserved).toBe(100);
      });

      it('succeeds when reserved less than on hand', () => {
        const result = InventoryDomain.create({
          ...validInventoryProps,
          quantityOnHand: 100,
          quantityReserved: 50,
        });
        
        expect(result.isSuccess).toBe(true);
      });

      it('fails when reserved exceeds on hand', () => {
        const result = InventoryDomain.create({
          ...validInventoryProps,
          quantityOnHand: 100,
          quantityReserved: 150,
        });
        
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('Quantity reserved cannot exceed quantity on hand');
        expect(result.errorCode).toBe('INVENTORY_RESERVED_EXCEEDS_ON_HAND');
      });
    });

    describe('Invariant 4: Available = on hand - reserved (computed)', () => {
      it('calculates available correctly', () => {
        const result = InventoryDomain.create({
          ...validInventoryProps,
          quantityOnHand: 100,
          quantityReserved: 30,
        });
        
        expect(result.isSuccess).toBe(true);
        expect(result.value?.quantityAvailable).toBe(70);
      });

      it('calculates available as zero when fully reserved', () => {
        const result = InventoryDomain.create({
          ...validInventoryProps,
          quantityOnHand: 50,
          quantityReserved: 50,
        });
        
        expect(result.isSuccess).toBe(true);
        expect(result.value?.quantityAvailable).toBe(0);
      });

      it('calculates available as on hand when no reservations', () => {
        const result = InventoryDomain.create({
          ...validInventoryProps,
          quantityOnHand: 75,
        });
        
        expect(result.isSuccess).toBe(true);
        expect(result.value?.quantityAvailable).toBe(75);
      });
    });

    describe('Invariant 5: Serial number requires lot number', () => {
      it('succeeds with both lot and serial', () => {
        const result = InventoryDomain.create({
          ...validInventoryProps,
          lotNumber: 'LOT-001',
          serialNumber: 'SN-001',
        });
        
        expect(result.isSuccess).toBe(true);
        expect(result.value?.lotNumber).toBe('LOT-001');
        expect(result.value?.serialNumber).toBe('SN-001');
      });

      it('succeeds with only lot number', () => {
        const result = InventoryDomain.create({
          ...validInventoryProps,
          lotNumber: 'LOT-001',
        });
        
        expect(result.isSuccess).toBe(true);
        expect(result.value?.lotNumber).toBe('LOT-001');
        expect(result.value?.serialNumber).toBeNull();
      });

      it('succeeds with neither lot nor serial', () => {
        const result = InventoryDomain.create(validInventoryProps);
        
        expect(result.isSuccess).toBe(true);
        expect(result.value?.lotNumber).toBeNull();
        expect(result.value?.serialNumber).toBeNull();
      });

      it('fails with serial number but no lot number', () => {
        const result = InventoryDomain.create({
          ...validInventoryProps,
          serialNumber: 'SN-001',
        });
        
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('Serial number requires lot number');
        expect(result.errorCode).toBe('INVENTORY_SERIAL_REQUIRES_LOT');
      });
    });

    describe('Invariant 6: Status transitions validated', () => {
      it('defaults to AVAILABLE status', () => {
        const result = InventoryDomain.create(validInventoryProps);
        
        expect(result.isSuccess).toBe(true);
        expect(result.value?.status).toBe('AVAILABLE');
      });

      it('allows QUARANTINE status on creation', () => {
        const result = InventoryDomain.create({
          ...validInventoryProps,
          status: 'QUARANTINE',
        });
        
        expect(result.isSuccess).toBe(true);
        expect(result.value?.status).toBe('QUARANTINE');
      });
    });
  });

  describe('updateQuantity()', () => {
    const existingInventory: Inventory = {
      id: 'inv-1',
      tenantId: 'tenant-1',
      itemId: 'item-1',
      locationId: 'loc-1',
      locationType: 'WAREHOUSE',
      quantityOnHand: 100,
      quantityReserved: 25,
      quantityAvailable: 75,
      lotNumber: null,
      serialNumber: null,
      expiryDate: null,
      status: 'AVAILABLE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('updates quantity on hand correctly', () => {
      const result = InventoryDomain.updateQuantity(existingInventory, {
        quantityOnHand: 150,
      });
      
      expect(result.isSuccess).toBe(true);
      expect(result.value?.quantityOnHand).toBe(150);
      expect(result.value?.quantityReserved).toBe(25);
      expect(result.value?.quantityAvailable).toBe(125);
    });

    it('updates both on hand and reserved', () => {
      const result = InventoryDomain.updateQuantity(existingInventory, {
        quantityOnHand: 200,
        quantityReserved: 50,
      });
      
      expect(result.isSuccess).toBe(true);
      expect(result.value?.quantityOnHand).toBe(200);
      expect(result.value?.quantityReserved).toBe(50);
      expect(result.value?.quantityAvailable).toBe(150);
    });

    it('fails when new on hand is negative', () => {
      const result = InventoryDomain.updateQuantity(existingInventory, {
        quantityOnHand: -10,
      });
      
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Quantity on hand cannot be negative');
    });

    it('fails when new reserved exceeds new on hand', () => {
      const result = InventoryDomain.updateQuantity(existingInventory, {
        quantityOnHand: 50,
        quantityReserved: 75,
      });
      
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Quantity reserved (75) cannot exceed quantity on hand (50)');
    });
  });

  describe('reserve()', () => {
    const availableInventory: Inventory = {
      id: 'inv-1',
      tenantId: 'tenant-1',
      itemId: 'item-1',
      locationId: 'loc-1',
      locationType: 'WAREHOUSE',
      quantityOnHand: 100,
      quantityReserved: 20,
      quantityAvailable: 80,
      lotNumber: null,
      serialNumber: null,
      expiryDate: null,
      status: 'AVAILABLE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('reserves quantity successfully', () => {
      const result = InventoryDomain.reserve(availableInventory, {
        quantity: 30,
      });
      
      expect(result.isSuccess).toBe(true);
      expect(result.value?.quantityReserved).toBe(50);
      expect(result.value?.quantityAvailable).toBe(50);
      expect(result.value?.status).toBe('AVAILABLE');
    });

    it('fully reserves remaining available', () => {
      const result = InventoryDomain.reserve(availableInventory, {
        quantity: 80,
      });
      
      expect(result.isSuccess).toBe(true);
      expect(result.value?.quantityReserved).toBe(100);
      expect(result.value?.quantityAvailable).toBe(0);
      expect(result.value?.status).toBe('RESERVED');
    });

    it('fails when reserving more than available', () => {
      const result = InventoryDomain.reserve(availableInventory, {
        quantity: 90,
      });
      
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Insufficient inventory to reserve 90 (available: 80)');
      expect(result.errorCode).toBe('INVENTORY_INSUFFICIENT_FOR_RESERVATION');
    });

    it('fails when reservation quantity is zero', () => {
      const result = InventoryDomain.reserve(availableInventory, {
        quantity: 0,
      });
      
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Reservation quantity must be positive');
    });

    it('fails when reservation quantity is negative', () => {
      const result = InventoryDomain.reserve(availableInventory, {
        quantity: -10,
      });
      
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Reservation quantity must be positive');
    });
  });

  describe('releaseReservation()', () => {
    const reservedInventory: Inventory = {
      id: 'inv-1',
      tenantId: 'tenant-1',
      itemId: 'item-1',
      locationId: 'loc-1',
      locationType: 'WAREHOUSE',
      quantityOnHand: 100,
      quantityReserved: 60,
      quantityAvailable: 40,
      lotNumber: null,
      serialNumber: null,
      expiryDate: null,
      status: 'AVAILABLE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('releases reservation successfully', () => {
      const result = InventoryDomain.releaseReservation(reservedInventory, {
        quantity: 20,
      });
      
      expect(result.isSuccess).toBe(true);
      expect(result.value?.quantityReserved).toBe(40);
      expect(result.value?.quantityAvailable).toBe(60);
    });

    it('releases all reservations', () => {
      const fullyReserved = { ...reservedInventory, quantityReserved: 100, quantityAvailable: 0, status: 'RESERVED' as const };
      const result = InventoryDomain.releaseReservation(fullyReserved, {
        quantity: 100,
      });
      
      expect(result.isSuccess).toBe(true);
      expect(result.value?.quantityReserved).toBe(0);
      expect(result.value?.quantityAvailable).toBe(100);
      expect(result.value?.status).toBe('AVAILABLE');
    });

    it('fails when releasing more than reserved', () => {
      const result = InventoryDomain.releaseReservation(reservedInventory, {
        quantity: 70,
      });
      
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Cannot release 70 (only 60 reserved)');
      expect(result.errorCode).toBe('INVENTORY_RELEASE_EXCEEDS_RESERVED');
    });

    it('fails when release quantity is zero', () => {
      const result = InventoryDomain.releaseReservation(reservedInventory, {
        quantity: 0,
      });
      
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Release quantity must be positive');
    });

    it('fails when release quantity is negative', () => {
      const result = InventoryDomain.releaseReservation(reservedInventory, {
        quantity: -10,
      });
      
      expect(result.isFailure).toBe(true);
    });
  });

  describe('changeStatus()', () => {
    const availableInventory: Inventory = {
      id: 'inv-1',
      tenantId: 'tenant-1',
      itemId: 'item-1',
      locationId: 'loc-1',
      locationType: 'WAREHOUSE',
      quantityOnHand: 100,
      quantityReserved: 0,
      quantityAvailable: 100,
      lotNumber: null,
      serialNumber: null,
      expiryDate: null,
      status: 'AVAILABLE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('transitions AVAILABLE → QUARANTINE', () => {
      const result = InventoryDomain.changeStatus(availableInventory, 'QUARANTINE');
      
      expect(result.isSuccess).toBe(true);
      expect(result.value?.status).toBe('QUARANTINE');
    });

    it('transitions AVAILABLE → DAMAGED', () => {
      const result = InventoryDomain.changeStatus(availableInventory, 'DAMAGED');
      
      expect(result.isSuccess).toBe(true);
      expect(result.value?.status).toBe('DAMAGED');
    });

    it('allows AVAILABLE → TRANSIT', () => {
      const result = InventoryDomain.changeStatus(availableInventory, 'TRANSIT');
      
      expect(result.isSuccess).toBe(true);
      expect(result.value?.status).toBe('TRANSIT');
    });

    it('rejects invalid transition AVAILABLE → EXPIRED (must go through QUARANTINE)', () => {
      const result = InventoryDomain.changeStatus(availableInventory, 'EXPIRED');
      
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Cannot transition from AVAILABLE to EXPIRED');
    });

    describe('Invariant 7: Cannot mark DAMAGED/EXPIRED with reservations', () => {
      const inventoryWithReservations: Inventory = {
        ...availableInventory,
        quantityReserved: 25,
        quantityAvailable: 75,
      };

      it('fails to mark DAMAGED when reservations exist', () => {
        const result = InventoryDomain.changeStatus(inventoryWithReservations, 'DAMAGED');
        
        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Cannot mark as DAMAGED while 25 units are reserved');
        expect(result.errorCode).toBe('INVENTORY_RESERVED_UNITS_PREVENT_STATUS_CHANGE');
      });

      it('fails to mark EXPIRED from QUARANTINE when reservations exist', () => {
        const quarantineWithReservations: Inventory = {
          ...inventoryWithReservations,
          status: 'QUARANTINE',
        };
        
        const result = InventoryDomain.changeStatus(quarantineWithReservations, 'EXPIRED');
        
        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Cannot mark as EXPIRED while 25 units are reserved');
      });

      it('succeeds to mark DAMAGED when no reservations', () => {
        const result = InventoryDomain.changeStatus(availableInventory, 'DAMAGED');
        
        expect(result.isSuccess).toBe(true);
        expect(result.value?.status).toBe('DAMAGED');
      });
    });
  });

  describe('isAvailableForReservation()', () => {
    it('returns true when AVAILABLE with quantity', () => {
      const inventory: Inventory = {
        id: 'inv-1',
        tenantId: 'tenant-1',
        itemId: 'item-1',
        locationId: 'loc-1',
        locationType: 'WAREHOUSE',
        quantityOnHand: 100,
        quantityReserved: 20,
        quantityAvailable: 80,
        lotNumber: null,
        serialNumber: null,
        expiryDate: null,
        status: 'AVAILABLE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      expect(InventoryDomain.isAvailableForReservation(inventory)).toBe(true);
    });

    it('returns false when AVAILABLE but zero quantity', () => {
      const inventory: Inventory = {
        id: 'inv-1',
        tenantId: 'tenant-1',
        itemId: 'item-1',
        locationId: 'loc-1',
        locationType: 'WAREHOUSE',
        quantityOnHand: 100,
        quantityReserved: 100,
        quantityAvailable: 0,
        lotNumber: null,
        serialNumber: null,
        expiryDate: null,
        status: 'AVAILABLE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      expect(InventoryDomain.isAvailableForReservation(inventory)).toBe(false);
    });

    it('returns false when QUARANTINE', () => {
      const inventory: Inventory = {
        id: 'inv-1',
        tenantId: 'tenant-1',
        itemId: 'item-1',
        locationId: 'loc-1',
        locationType: 'WAREHOUSE',
        quantityOnHand: 100,
        quantityReserved: 0,
        quantityAvailable: 100,
        lotNumber: null,
        serialNumber: null,
        expiryDate: null,
        status: 'QUARANTINE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      expect(InventoryDomain.isAvailableForReservation(inventory)).toBe(false);
    });
  });

  describe('hasExpired()', () => {
    it('returns true when expiry date has passed', () => {
      const inventory: Inventory = {
        id: 'inv-1',
        tenantId: 'tenant-1',
        itemId: 'item-1',
        locationId: 'loc-1',
        locationType: 'WAREHOUSE',
        quantityOnHand: 100,
        quantityReserved: 0,
        quantityAvailable: 100,
        lotNumber: 'LOT-001',
        serialNumber: null,
        expiryDate: new Date('2024-01-01'),
        status: 'AVAILABLE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      expect(InventoryDomain.hasExpired(inventory, new Date('2024-06-01'))).toBe(true);
    });

    it('returns false when expiry date is in future', () => {
      const inventory: Inventory = {
        id: 'inv-1',
        tenantId: 'tenant-1',
        itemId: 'item-1',
        locationId: 'loc-1',
        locationType: 'WAREHOUSE',
        quantityOnHand: 100,
        quantityReserved: 0,
        quantityAvailable: 100,
        lotNumber: 'LOT-001',
        serialNumber: null,
        expiryDate: new Date('2025-12-31'),
        status: 'AVAILABLE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      expect(InventoryDomain.hasExpired(inventory, new Date('2024-01-01'))).toBe(false);
    });

    it('returns false when no expiry date', () => {
      const inventory: Inventory = {
        id: 'inv-1',
        tenantId: 'tenant-1',
        itemId: 'item-1',
        locationId: 'loc-1',
        locationType: 'WAREHOUSE',
        quantityOnHand: 100,
        quantityReserved: 0,
        quantityAvailable: 100,
        lotNumber: null,
        serialNumber: null,
        expiryDate: null,
        status: 'AVAILABLE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      expect(InventoryDomain.hasExpired(inventory)).toBe(false);
    });
  });
});
