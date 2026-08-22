/**
 * E7.2 Movement Repository Tests (Smoke Test)
 * 
 * Minimal tests to verify persistence boundary.
 * 
 * Focus:
 * - Basic CRUD works
 * - Tenant isolation
 * - DB ↔ Domain mapping
 * 
 * NOT testing:
 * - Complex queries (deferred)
 * - Performance (deferred)
 * - Transaction rollback (deferred)
 */

import { MovementRepository } from '../movement.repository';
import { MovementDomain } from '../../domain/movement.domain';
import type { CreateMovementProps } from '../../domain/movement.types';

describe('MovementRepository (Smoke Test)', () => {
  let repository: MovementRepository;
  const tenantId = 'tenant-repo-test';

  beforeAll(() => {
    repository = new MovementRepository();
  });

  describe('save() and findById()', () => {
    it('should save movement and retrieve it by ID', async () => {
      // Create domain movement
      const props: CreateMovementProps = {
        movementNumber: `TEST-${Date.now()}`,
        tenantId,
        movementType: 'RECEIPT',
        direction: 'INBOUND',
        itemId: 'item-test-1',
        quantity: 100,
        unitOfMeasure: 'EA',
        toLocationId: 'loc-test-1',
        toLocationType: 'WAREHOUSE',
        createdBy: 'test-user',
      };

      const domainResult = MovementDomain.create(props);
      expect(domainResult.isSuccess).toBe(true);

      const movement = domainResult.value!;

      // Save to database
      const saveResult = await repository.save(movement);
      expect(saveResult.isSuccess).toBe(true);

      const savedMovement = saveResult.value!;
      expect(savedMovement.id).toBe(movement.id);
      expect(savedMovement.movementNumber).toBe(props.movementNumber);

      // Retrieve by ID
      const findResult = await repository.findById(tenantId, movement.id);
      expect(findResult.isSuccess).toBe(true);
      expect(findResult.value).not.toBeNull();

      const retrieved = findResult.value!;
      expect(retrieved.id).toBe(movement.id);
      expect(retrieved.movementNumber).toBe(props.movementNumber);
      expect(retrieved.quantity).toBe(100);
      expect(retrieved.direction).toBe('INBOUND');
    });

    it('should return null for non-existent ID', async () => {
      const result = await repository.findById(tenantId, 'non-existent-id');

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeNull();
    });
  });

  describe('findByMovementNumber()', () => {
    it('should find movement by business key', async () => {
      const movementNumber = `TEST-BK-${Date.now()}`;

      const props: CreateMovementProps = {
        movementNumber,
        tenantId,
        movementType: 'ISSUE',
        direction: 'OUTBOUND',
        itemId: 'item-test-2',
        quantity: 50,
        unitOfMeasure: 'EA',
        fromLocationId: 'loc-test-2',
        fromLocationType: 'WAREHOUSE',
        createdBy: 'test-user',
      };

      const domainResult = MovementDomain.create(props);
      const movement = domainResult.value!;

      await repository.save(movement);

      // Find by movement number
      const findResult = await repository.findByMovementNumber(tenantId, movementNumber);
      expect(findResult.isSuccess).toBe(true);
      expect(findResult.value).not.toBeNull();

      const retrieved = findResult.value!;
      expect(retrieved.movementNumber).toBe(movementNumber);
      expect(retrieved.itemId).toBe('item-test-2');
    });

    it('should return null for non-existent movement number', async () => {
      const result = await repository.findByMovementNumber(tenantId, 'NON-EXISTENT');

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeNull();
    });
  });

  describe('Tenant Isolation', () => {
    it('should not find movement from different tenant', async () => {
      const movementNumber = `TEST-TENANT-${Date.now()}`;
      const tenant1 = 'tenant-1';
      const tenant2 = 'tenant-2';

      // Create movement for tenant 1
      const props: CreateMovementProps = {
        movementNumber,
        tenantId: tenant1,
        movementType: 'RECEIPT',
        direction: 'INBOUND',
        itemId: 'item-isolated',
        quantity: 10,
        unitOfMeasure: 'EA',
        toLocationId: 'loc-isolated',
        toLocationType: 'WAREHOUSE',
        createdBy: 'test-user',
      };

      const domainResult = MovementDomain.create(props);
      const movement = domainResult.value!;

      await repository.save(movement);

      // Try to find from tenant 2
      const findResult = await repository.findByMovementNumber(tenant2, movementNumber);
      expect(findResult.isSuccess).toBe(true);
      expect(findResult.value).toBeNull(); // Should not find (tenant isolation)
    });
  });

  describe('list() with filters', () => {
    it('should list movements for tenant with itemId filter', async () => {
      const itemId = `item-list-${Date.now()}`;

      // Create 2 movements for same item
      for (let i = 0; i < 2; i++) {
        const props: CreateMovementProps = {
          movementNumber: `TEST-LIST-${Date.now()}-${i}`,
          tenantId,
          movementType: 'RECEIPT',
          direction: 'INBOUND',
          itemId,
          quantity: 10 + i,
          unitOfMeasure: 'EA',
          toLocationId: 'loc-list',
          toLocationType: 'WAREHOUSE',
          createdBy: 'test-user',
        };

        const domainResult = MovementDomain.create(props);
        await repository.save(domainResult.value!);
      }

      // List with filter
      const listResult = await repository.list(tenantId, { itemId });
      expect(listResult.isSuccess).toBe(true);
      expect(listResult.value!.length).toBeGreaterThanOrEqual(2);

      const movements = listResult.value!;
      movements.forEach((m) => {
        expect(m.itemId).toBe(itemId);
        expect(m.tenantId).toBe(tenantId);
      });
    });
  });

  describe('DB ↔ Domain Mapping', () => {
    it('should preserve all domain fields through save/retrieve cycle', async () => {
      const props: CreateMovementProps = {
        movementNumber: `TEST-MAP-${Date.now()}`,
        tenantId,
        movementType: 'SHIPMENT',
        direction: 'OUTBOUND',
        itemId: 'item-map',
        quantity: 25.5, // Fractional
        unitOfMeasure: 'KG',
        fromLocationId: 'loc-from',
        fromLocationType: 'WAREHOUSE',
        toLocationId: 'loc-to',
        toLocationType: 'STORE',
        lotNumber: 'LOT-MAP-001',
        serialNumber: 'SN-MAP-001',
        unitCost: 10.50,
        totalCost: 267.75,
        currency: 'USD',
        sourceDocumentType: 'SALES_ORDER',
        sourceDocumentId: 'SO-12345',
        reason: 'Customer order fulfillment',
        notes: 'Expedited shipping',
        createdBy: 'test-user',
      };

      const domainResult = MovementDomain.create(props);
      const movement = domainResult.value!;

      await repository.save(movement);

      const retrievedResult = await repository.findById(tenantId, movement.id);
      const retrieved = retrievedResult.value!;

      // Verify all fields preserved
      expect(retrieved.movementNumber).toBe(props.movementNumber);
      expect(retrieved.movementType).toBe('SHIPMENT');
      expect(retrieved.direction).toBe('OUTBOUND');
      expect(retrieved.quantity).toBe(25.5);
      expect(retrieved.unitOfMeasure).toBe('KG');
      expect(retrieved.fromLocationId).toBe('loc-from');
      expect(retrieved.toLocationId).toBe('loc-to');
      expect(retrieved.lotNumber).toBe('LOT-MAP-001');
      expect(retrieved.serialNumber).toBe('SN-MAP-001');
      expect(retrieved.unitCost).toBe(10.50);
      expect(retrieved.totalCost).toBe(267.75);
      expect(retrieved.currency).toBe('USD');
      expect(retrieved.sourceDocumentType).toBe('SALES_ORDER');
      expect(retrieved.sourceDocumentId).toBe('SO-12345');
      expect(retrieved.reason).toBe('Customer order fulfillment');
      expect(retrieved.notes).toBe('Expedited shipping');
    });
  });
});
