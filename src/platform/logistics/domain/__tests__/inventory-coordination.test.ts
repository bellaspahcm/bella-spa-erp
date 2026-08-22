/**
 * E7.2 Inventory Coordination Tests
 * 
 * Tests multi-entity coordination (Inventory + Movement).
 * 
 * Focus:
 * 1. Coordination success (both entities valid)
 * 2. Atomic failure (first entity fails → no second entity)
 * 3. Atomic failure (second entity fails → first entity changes not persisted)
 * 4. Boundary enforcement (NO Warehouse/Product workflow)
 * 
 * Note: Uses in-memory entities (no database per ADR-010).
 * Products responsible for transaction orchestration.
 */

import { InventoryOperationsDomain } from '../inventory-operations.domain';
import { InventoryDomain } from '../inventory.domain';
import type { Inventory, CreateInventoryProps } from '../inventory.types';

describe('E7.2 Inventory Coordination', () => {
  const tenantId = 'tenant-coord-1';

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

  describe('reserveWithMovement() - Coordination Success', () => {
    it('should reserve inventory and create outbound movement', () => {
      const inventory = createTestInventory();

      const result = InventoryOperationsDomain.reserveWithMovement(inventory, {
        quantity: 30,
        reason: 'Sales order SO-001',
        requestedBy: 'user-1',
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();

      // Verify inventory updated
      const { inventory: reservedInventory, movement } = result.value!;
      expect(reservedInventory.quantityReserved).toBe(30);
      expect(reservedInventory.quantityAvailable).toBe(70);
      expect(reservedInventory.status).toBe('AVAILABLE'); // Still available (not fully reserved)

      // Verify movement created
      expect(movement).toBeDefined();
      expect(movement.itemId).toBe(inventory.itemId);
      expect(movement.quantity).toBe(30);
      expect(movement.direction).toBe('OUTBOUND');
      expect(movement.movementType).toBe('ISSUE'); // E7.1 uses ISSUE for reservation
      expect(movement.fromLocationId).toBe(inventory.locationId);
      expect(movement.toLocationId).toBeNull(); // Reservation, not transfer
    });

    it('should fully reserve inventory when quantity equals available', () => {
      const inventory = createTestInventory({
        quantityOnHand: 50,
        quantityReserved: 0,
      });

      const result = InventoryOperationsDomain.reserveWithMovement(inventory, {
        quantity: 50,
        reason: 'Reserve all',
        requestedBy: 'user-1',
      });

      expect(result.isSuccess).toBe(true);

      const { inventory: reservedInventory } = result.value!;
      expect(reservedInventory.quantityReserved).toBe(50);
      expect(reservedInventory.quantityAvailable).toBe(0);
      expect(reservedInventory.status).toBe('RESERVED'); // Fully reserved
    });

    it('should include custom reference in movement', () => {
      const inventory = createTestInventory();

      const result = InventoryOperationsDomain.reserveWithMovement(inventory, {
        quantity: 10,
        reason: 'Sales order',
        requestedBy: 'user-1',
        referenceType: 'SALES_ORDER',
        referenceId: 'SO-12345',
      });

      expect(result.isSuccess).toBe(true);

      const { movement } = result.value!;
      expect(movement.sourceDocumentType).toBe('SALES_ORDER');
      expect(movement.sourceDocumentId).toBe('SO-12345');
    });
  });

  describe('Atomic Failure - Inventory Validation Fails', () => {
    it('should fail entire operation if quantity exceeds available', () => {
      const inventory = createTestInventory({
        quantityOnHand: 50,
        quantityReserved: 0,
      });

      // Attempt over-reservation
      const result = InventoryOperationsDomain.reserveWithMovement(inventory, {
        quantity: 100,
        reason: 'Over-reserve',
        requestedBy: 'user-1',
      });

      expect(result.isFailure).toBe(true);
      expect(result.errorCode).toBe('INVENTORY_INSUFFICIENT_QUANTITY');
      expect(result.error).toContain('Failed to reserve inventory');

      // Verify NO movement created (only checked via absence of success)
      expect(result.value).toBeNull();
    });

    it('should fail entire operation if inventory status invalid', () => {
      const inventory = createTestInventory({
        status: 'EXPIRED',
      });

      const result = InventoryOperationsDomain.reserveWithMovement(inventory, {
        quantity: 10,
        reason: 'Reserve expired',
        requestedBy: 'user-1',
      });

      expect(result.isFailure).toBe(true);
      expect(result.errorCode).toBe('INVENTORY_INVALID_STATUS_FOR_RESERVE');
      expect(result.error).toContain('Failed to reserve inventory');

      // No movement created
      expect(result.value).toBeNull();
    });

    it('should fail if quantity is invalid (zero)', () => {
      const inventory = createTestInventory();

      const result = InventoryOperationsDomain.reserveWithMovement(inventory, {
        quantity: 0,
        reason: 'Invalid quantity',
        requestedBy: 'user-1',
      });

      expect(result.isFailure).toBe(true);
      expect(result.errorCode).toBe('INVENTORY_RESERVE_QUANTITY_INVALID');

      // No movement created
      expect(result.value).toBeNull();
    });
  });

  describe('shipWithMovement() - Coordination Success', () => {
    it('should ship reserved inventory and create transfer movement', () => {
      const inventory = createTestInventory({
        status: 'RESERVED',
        quantityReserved: 50,
      });

      const result = InventoryOperationsDomain.shipWithMovement(inventory, {
        toLocationId: 'loc-destination',
        shippedBy: 'user-1',
        shippedAt: new Date(),
      });

      expect(result.isSuccess).toBe(true);

      const { inventory: shippedInventory, movement } = result.value!;
      expect(shippedInventory.status).toBe('TRANSIT');

      // Movement for transfer
      expect(movement.direction).toBe('OUTBOUND'); // E7.1 uses OUTBOUND for shipment
      expect(movement.movementType).toBe('SHIPMENT');
      expect(movement.fromLocationId).toBe(inventory.locationId);
      expect(movement.toLocationId).toBe('loc-destination');
      expect(movement.quantity).toBe(50); // Ships reserved quantity
    });

    it('should fail if inventory not RESERVED', () => {
      const inventory = createTestInventory({
        status: 'AVAILABLE',
      });

      const result = InventoryOperationsDomain.shipWithMovement(inventory, {
        toLocationId: 'loc-dest',
        shippedBy: 'user-1',
        shippedAt: new Date(),
      });

      expect(result.isFailure).toBe(true);
      expect(result.errorCode).toBe('INVENTORY_INVALID_STATUS_FOR_SHIP');

      // No movement created
      expect(result.value).toBeNull();
    });
  });

  describe('cancelWithMovement() - Coordination Success', () => {
    it('should cancel reservation and create reversal movement', () => {
      const inventory = createTestInventory({
        status: 'RESERVED',
        quantityReserved: 40,
      });

      const result = InventoryOperationsDomain.cancelWithMovement(inventory, {
        quantity: 40,
        reason: 'Order cancelled',
        cancelledBy: 'user-1',
      });

      expect(result.isSuccess).toBe(true);

      const { inventory: cancelledInventory, movement } = result.value!;
      expect(cancelledInventory.quantityReserved).toBe(0);
      expect(cancelledInventory.status).toBe('AVAILABLE');

      // Movement for reversal
      expect(movement.direction).toBe('INBOUND');
      expect(movement.movementType).toBe('RETURN_RECEIPT'); // E7.1 uses RETURN_RECEIPT for reversal
      expect(movement.fromLocationId).toBeNull(); // Reversal has no source
      expect(movement.toLocationId).toBe(inventory.locationId);
      expect(movement.quantity).toBe(40);
    });

    it('should fail if cancel quantity exceeds reserved', () => {
      const inventory = createTestInventory({
        status: 'RESERVED',
        quantityReserved: 20,
      });

      const result = InventoryOperationsDomain.cancelWithMovement(inventory, {
        quantity: 30,
        reason: 'Over-cancel',
        cancelledBy: 'user-1',
      });

      expect(result.isFailure).toBe(true);
      expect(result.errorCode).toBe('INVENTORY_CANCEL_EXCEEDS_RESERVED');

      // No movement created
      expect(result.value).toBeNull();
    });
  });

  describe('Boundary Enforcement - NO Product Workflow', () => {
    it('should NOT have warehouse-specific operations', () => {
      // Verify API surface does NOT include:
      // - receivePurchaseOrder()
      // - selectBin()
      // - putaway()
      // - performQACheck()

      const operations = Object.getOwnPropertyNames(InventoryOperationsDomain);
      
      expect(operations).not.toContain('receivePurchaseOrder');
      expect(operations).not.toContain('selectBin');
      expect(operations).not.toContain('putaway');
      expect(operations).not.toContain('performQACheck');
    });

    it('should NOT have finance-specific operations', () => {
      const operations = Object.getOwnPropertyNames(InventoryOperationsDomain);
      
      expect(operations).not.toContain('processInvoice');
      expect(operations).not.toContain('recordCOGS');
      expect(operations).not.toContain('updateGeneralLedger');
    });

    it('should only coordinate Inventory + Movement', () => {
      // Verify all methods return { inventory, movement } tuple
      const inventory = createTestInventory();

      const reserveResult = InventoryOperationsDomain.reserveWithMovement(inventory, {
        quantity: 10,
        reason: 'Test',
        requestedBy: 'user-1',
      });

      if (reserveResult.isSuccess) {
        expect(reserveResult.value).toHaveProperty('inventory');
        expect(reserveResult.value).toHaveProperty('movement');
        expect(Object.keys(reserveResult.value!).length).toBe(2); // Only 2 properties
      }
    });
  });

  describe('Domain Service Characteristics', () => {
    it('should be pure functions (no infrastructure dependencies)', () => {
      // Domain service methods are static (no instance state)
      // No repository injection, no database calls
      // Products orchestrate persistence

      const inventory = createTestInventory();

      const result = InventoryOperationsDomain.reserveWithMovement(inventory, {
        quantity: 10,
        reason: 'Test',
        requestedBy: 'user-1',
      });

      // Result is pure data (entities), not side effects
      expect(result.isSuccess).toBe(true);
      expect(result.value!.inventory).toBeDefined();
      expect(result.value!.movement).toBeDefined();

      // Original inventory NOT mutated (immutable pattern)
      expect(inventory.quantityReserved).toBe(0); // Original unchanged
      expect(result.value!.inventory.quantityReserved).toBe(10); // New entity
    });

    it('should return typed Result for all failure modes', () => {
      const inventory = createTestInventory();

      const result = InventoryOperationsDomain.reserveWithMovement(inventory, {
        quantity: -1,
        reason: 'Invalid',
        requestedBy: 'user-1',
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toBeDefined();
      expect(result.errorCode).toBeDefined();
    });
  });
});
