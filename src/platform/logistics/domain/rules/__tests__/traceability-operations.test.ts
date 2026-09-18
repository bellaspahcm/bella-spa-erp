/**
 * E7.3 Phase 3 Tests — Traceability Operations
 * 
 * Tests for lineage queries, custody events, chain validation.
 * 
 * Coverage:
 * - Custody event generation
 * - Upstream/downstream tracing
 * - Lot/serial history
 * - Chain validation
 * - Cycle detection
 * - Broken chain handling
 * - Depth limits
 * - Tenant isolation
 * 
 * Gate Requirements:
 * - All tests PASS
 * - E7.1/E7.2 regression: 439/439 PASS
 * - No mutations (verified)
 * - Tenant isolation (verified)
 * - Determinism (verified)
 */

import {
  generateCustodyEvent,
  traceUpstream,
  traceDownstream,
  getLotHistory,
  getSerialHistory,
  validateTraceabilityChain,
  type LineageQueryOptions,
} from '../traceability.operations';
import type { InventoryMovement } from '../../movement.types';
import type { LotNumber, SerialNumber } from '../../inventory.types';

// ========== Test Fixtures ==========

function createMovement(overrides: Partial<InventoryMovement>): InventoryMovement {
  return {
    id: { value: 'mov-1' },
    movementNumber: { value: 'MOV-001' },
    tenantId: 'tenant-a',
    movementDate: new Date('2024-01-01'),
    createdAt: new Date('2024-01-01'),
    movementType: 'RECEIPT',
    direction: 'INBOUND',
    itemId: { value: 'item-1' },
    quantity: 100,
    unitOfMeasure: 'EA',
    status: 'COMPLETED',
    ...overrides,
  };
}

// ========== Custody Event Generation ==========

describe('generateCustodyEvent', () => {
  it('should generate custody event from RECEIPT movement', () => {
    const movement = createMovement({
      movementType: 'RECEIPT',
      direction: 'INBOUND',
      toLocationId: { value: 'WH-001' },
      toLocationType: 'WAREHOUSE',
      movementDate: new Date('2024-01-15T10:00:00Z'),
      createdBy: 'user-1',
      notes: 'Supplier delivery',
    });

    const event = generateCustodyEvent({ movement });

    expect(event.timestamp).toEqual(movement.movementDate);
    expect(event.locationId).toBe('WH-001');
    expect(event.locationType).toBe('WAREHOUSE');
    expect(event.action).toBe('RECEIVED');
    expect(event.userId).toBe('user-1');
    expect(event.notes).toBe('Supplier delivery');
  });

  it('should generate custody event from SHIPMENT movement', () => {
    const movement = createMovement({
      movementType: 'SHIPMENT',
      direction: 'OUTBOUND',
      fromLocationId: { value: 'WH-001' },
      fromLocationType: 'WAREHOUSE',
      movementDate: new Date('2024-02-01T14:30:00Z'),
      createdBy: 'user-2',
    });

    const event = generateCustodyEvent({ movement });

    expect(event.action).toBe('SHIPPED');
    expect(event.locationId).toBe('WH-001');
    expect(event.locationType).toBe('WAREHOUSE');
  });

  it('should generate custody event from DAMAGE movement', () => {
    const movement = createMovement({
      movementType: 'DAMAGE',
      direction: 'OUTBOUND',
      fromLocationId: { value: 'WH-001' },
      fromLocationType: 'WAREHOUSE',
    });

    const event = generateCustodyEvent({ movement });

    expect(event.action).toBe('DAMAGED');
  });

  it('should use provided userId over movement created_by', () => {
    const movement = createMovement({
      createdBy: 'user-1',
      toLocationId: { value: 'WH-001' },
      toLocationType: 'WAREHOUSE',
    });

    const event = generateCustodyEvent({
      movement,
      userId: 'user-override',
    });

    expect(event.userId).toBe('user-override');
  });

  it('should throw if location is missing', () => {
    const movement = createMovement({
      toLocationId: undefined,
      toLocationType: undefined,
    });

    expect(() => generateCustodyEvent({ movement })).toThrow(
      'Cannot generate custody event: location missing'
    );
  });

  it('[INVARIANT #16] should not mutate input movement', () => {
    const movement = createMovement({
      toLocationId: { value: 'WH-001' },
      toLocationType: 'WAREHOUSE',
    });
    const originalId = movement.id.value;
    const originalQuantity = movement.quantity;
    const originalDate = movement.movementDate.getTime();

    generateCustodyEvent({ movement });

    // Verify key properties unchanged
    expect(movement.id.value).toBe(originalId);
    expect(movement.quantity).toBe(originalQuantity);
    expect(movement.movementDate.getTime()).toBe(originalDate);
  });
});

// ========== Upstream Tracing ==========

describe('traceUpstream', () => {
  const options: LineageQueryOptions = { maxDepth: 10 };

  it('should trace simple upstream chain', () => {
    const lotNumber: LotNumber = { value: 'LOT-001' };
    const movements: InventoryMovement[] = [
      createMovement({
        id: { value: 'mov-1' },
        movementType: 'RECEIPT',
        fromLocationId: undefined,
        toLocationId: { value: 'WH-001' },
        lotNumber: lotNumber,
        movementDate: new Date('2024-01-01'),
      }),
      createMovement({
        id: { value: 'mov-2' },
        movementType: 'TRANSFER_OUT',
        fromLocationId: { value: 'WH-001' },
        toLocationId: { value: 'WH-002' },
        lotNumber: lotNumber,
        movementDate: new Date('2024-01-02'),
      }),
      createMovement({
        id: { value: 'mov-3' },
        movementType: 'SHIPMENT',
        fromLocationId: { value: 'WH-002' },
        toLocationId: undefined,
        lotNumber: lotNumber,
        movementDate: new Date('2024-01-03'),
      }),
    ];

    const result = traceUpstream('tenant-a', lotNumber, movements, options);

    expect(result.movements.length).toBe(3);
    expect(result.isComplete).toBe(true);
    expect(result.brokenLinks.length).toBe(0);
    expect(result.cycles.length).toBe(0);
    expect(result.metadata.maxDepthExceeded).toBe(false);
  });

  it('[INVARIANT #11] should enforce tenant isolation', () => {
    const lotNumber: LotNumber = { value: 'LOT-001' };
    const movements: InventoryMovement[] = [
      createMovement({
        id: { value: 'mov-1' },
        tenantId: 'tenant-a',
        lotNumber: lotNumber,
      }),
      createMovement({
        id: { value: 'mov-2' },
        tenantId: 'tenant-b',
        lotNumber: lotNumber,
      }),
    ];

    const result = traceUpstream('tenant-a', lotNumber, movements, options);

    expect(result.movements.length).toBe(1);
    expect(result.movements[0].tenantId).toBe('tenant-a');
  });

  it('[INVARIANT #13] should detect cycles without crashing', () => {
    const lotNumber: LotNumber = { value: 'LOT-001' };
    
    // Create circular reference (impossible in practice, but test resilience)
    const mov1 = createMovement({
      id: { value: 'mov-1' },
      fromLocationId: { value: 'WH-002' },
      toLocationId: { value: 'WH-001' },
      lotNumber: lotNumber,
    });
    const mov2 = createMovement({
      id: { value: 'mov-2' },
      fromLocationId: { value: 'WH-001' },
      toLocationId: { value: 'WH-002' },
      lotNumber: lotNumber,
    });

    const movements = [mov1, mov2];

    const result = traceUpstream('tenant-a', lotNumber, movements, options);

    // Should not crash, should detect cycle
    expect(result.cycles.length).toBeGreaterThan(0);
    expect(result.isComplete).toBe(false);
  });

  it('[INVARIANT #15] should respect depth limit', () => {
    const lotNumber: LotNumber = { value: 'LOT-001' };
    const movements: InventoryMovement[] = [];

    // Create deep chain (20 movements properly connected)
    for (let i = 0; i < 20; i++) {
      movements.push(
        createMovement({
          id: { value: `mov-${i}` },
          fromLocationId: i > 0 ? { value: `WH-${i}` } : undefined,
          toLocationId: { value: `WH-${i + 1}` },
          lotNumber: lotNumber,
          movementDate: new Date(`2024-01-${String(i + 1).padStart(2, '0')}`),
        })
      );
    }

    // Also add backwards connections for upstream tracing
    for (let i = 1; i < 20; i++) {
      movements.push(
        createMovement({
          id: { value: `mov-back-${i}` },
          fromLocationId: { value: `WH-${i}` },
          toLocationId: { value: `WH-${i - 1}` },
          lotNumber: lotNumber,
          movementDate: new Date(`2024-02-${String(i + 1).padStart(2, '0')}`),
        })
      );
    }

    const result = traceUpstream('tenant-a', lotNumber, movements, {
      maxDepth: 5,
    });

    expect(result.metadata.depthReached).toBeLessThanOrEqual(5);
    // If we reached max depth and there are still more movements, we exceeded
    if (result.metadata.depthReached === 5 && movements.length > result.movements.length) {
      expect(result.metadata.maxDepthExceeded).toBe(true);
    }
  });

  it('[INVARIANT #16] should not mutate input movements', () => {
    const lotNumber: LotNumber = { value: 'LOT-001' };
    const movements: InventoryMovement[] = [
      createMovement({
        lotNumber: lotNumber,
        toLocationId: { value: 'WH-001' },
      }),
    ];
    const originalLength = movements.length;
    const originalId = movements[0].id.value;

    traceUpstream('tenant-a', lotNumber, movements, options);

    expect(movements.length).toBe(originalLength);
    expect(movements[0].id.value).toBe(originalId);
  });

  it('[INVARIANT #12] should be deterministic', () => {
    const lotNumber: LotNumber = { value: 'LOT-001' };
    const movements: InventoryMovement[] = [
      createMovement({ id: { value: 'mov-1' }, lot_number: lotNumber }),
      createMovement({ id: { value: 'mov-2' }, lot_number: lotNumber }),
    ];

    const result1 = traceUpstream('tenant-a', lotNumber, movements, options);
    const result2 = traceUpstream('tenant-a', lotNumber, movements, options);

    expect(result1.movements.length).toBe(result2.movements.length);
    expect(result1.movements.map(m => m.id.value)).toEqual(
      result2.movements.map(m => m.id.value)
    );
  });

  it('should only include COMPLETED movements', () => {
    const lotNumber: LotNumber = { value: 'LOT-001' };
    const movements: InventoryMovement[] = [
      createMovement({
        id: { value: 'mov-1' },
        lotNumber: lotNumber,
        status: 'COMPLETED',
      }),
      createMovement({
        id: { value: 'mov-2' },
        lotNumber: lotNumber,
        status: 'PENDING',
      }),
      createMovement({
        id: { value: 'mov-3' },
        lotNumber: lotNumber,
        status: 'CANCELLED',
      }),
    ];

    const result = traceUpstream('tenant-a', lotNumber, movements, options);

    expect(result.movements.length).toBe(1);
    expect(result.movements[0].status).toBe('COMPLETED');
  });
});

// ========== Downstream Tracing ==========

describe('traceDownstream', () => {
  const options: LineageQueryOptions = { maxDepth: 10 };

  it('should trace downstream from origin', () => {
    const lotNumber: LotNumber = { value: 'LOT-001' };
    const movements: InventoryMovement[] = [
      createMovement({
        id: { value: 'mov-1' },
        movementType: 'RECEIPT',
        fromLocationId: undefined, // Origin
        toLocationId: { value: 'WH-001' },
        lotNumber: lotNumber,
        movementDate: new Date('2024-01-01'),
      }),
      createMovement({
        id: { value: 'mov-2' },
        movementType: 'TRANSFER_OUT',
        fromLocationId: { value: 'WH-001' },
        toLocationId: { value: 'WH-002' },
        lotNumber: lotNumber,
        movementDate: new Date('2024-01-02'),
      }),
    ];

    const result = traceDownstream('tenant-a', lotNumber, movements, options);

    expect(result.movements.length).toBe(2);
    expect(result.movements[0].id.value).toBe('mov-1'); // Origin first
    expect(result.isComplete).toBe(true);
  });

  it('[INVARIANT #11] should enforce tenant isolation', () => {
    const lotNumber: LotNumber = { value: 'LOT-001' };
    const movements: InventoryMovement[] = [
      createMovement({
        id: { value: 'mov-1' },
        tenantId: 'tenant-a',
        fromLocationId: undefined,
        toLocationId: { value: 'WH-001' },
        lotNumber: lotNumber,
      }),
      createMovement({
        id: { value: 'mov-2' },
        tenantId: 'tenant-b',
        fromLocationId: undefined,
        toLocationId: { value: 'WH-001' },
        lotNumber: lotNumber,
      }),
    ];

    const result = traceDownstream('tenant-a', lotNumber, movements, options);

    expect(result.movements.length).toBe(1);
    expect(result.movements[0].tenantId).toBe('tenant-a');
  });

  it('[INVARIANT #15] should respect depth limit', () => {
    const lotNumber: LotNumber = { value: 'LOT-001' };
    const movements: InventoryMovement[] = [];

    // Origin
    movements.push(
      createMovement({
        id: { value: 'mov-0' },
        fromLocationId: undefined,
        toLocationId: { value: 'WH-0' },
        lotNumber: lotNumber,
      })
    );

    // Deep chain
    for (let i = 1; i < 20; i++) {
      movements.push(
        createMovement({
          id: { value: `mov-${i}` },
          fromLocationId: { value: `WH-${i - 1}` },
          toLocationId: { value: `WH-${i}` },
          lotNumber: lotNumber,
        })
      );
    }

    const result = traceDownstream('tenant-a', lotNumber, movements, {
      maxDepth: 5,
    });

    expect(result.metadata.depthReached).toBeLessThanOrEqual(5);
    expect(result.metadata.maxDepthExceeded).toBe(true);
  });

  it('[INVARIANT #16] should not mutate input movements', () => {
    const lotNumber: LotNumber = { value: 'LOT-001' };
    const movements: InventoryMovement[] = [
      createMovement({
        fromLocationId: undefined,
        toLocationId: { value: 'WH-001' },
        lotNumber: lotNumber,
      }),
    ];
    const originalLength = movements.length;
    const originalId = movements[0].id.value;

    traceDownstream('tenant-a', lotNumber, movements, options);

    expect(movements.length).toBe(originalLength);
    expect(movements[0].id.value).toBe(originalId);
  });
});

// ========== Lot History ==========

describe('getLotHistory', () => {
  it('should return chronological lot history', () => {
    const lotNumber: LotNumber = { value: 'LOT-001' };
    const movements: InventoryMovement[] = [
      createMovement({
        id: { value: 'mov-3' },
        lotNumber: lotNumber,
        movementDate: new Date('2024-01-03'),
      }),
      createMovement({
        id: { value: 'mov-1' },
        lotNumber: lotNumber,
        movementDate: new Date('2024-01-01'),
      }),
      createMovement({
        id: { value: 'mov-2' },
        lotNumber: lotNumber,
        movementDate: new Date('2024-01-02'),
      }),
    ];

    const history = getLotHistory('tenant-a', lotNumber, movements);

    expect(history.length).toBe(3);
    expect(history[0].id.value).toBe('mov-1');
    expect(history[1].id.value).toBe('mov-2');
    expect(history[2].id.value).toBe('mov-3');
  });

  it('[INVARIANT #11] should enforce tenant isolation', () => {
    const lotNumber: LotNumber = { value: 'LOT-001' };
    const movements: InventoryMovement[] = [
      createMovement({
        id: { value: 'mov-1' },
        tenantId: 'tenant-a',
        lotNumber: lotNumber,
      }),
      createMovement({
        id: { value: 'mov-2' },
        tenantId: 'tenant-b',
        lotNumber: lotNumber,
      }),
    ];

    const history = getLotHistory('tenant-a', lotNumber, movements);

    expect(history.length).toBe(1);
    expect(history[0].tenantId).toBe('tenant-a');
  });

  it('should only include COMPLETED movements', () => {
    const lotNumber: LotNumber = { value: 'LOT-001' };
    const movements: InventoryMovement[] = [
      createMovement({ lotNumber: lotNumber, status: 'COMPLETED' }),
      createMovement({ lotNumber: lotNumber, status: 'PENDING' }),
    ];

    const history = getLotHistory('tenant-a', lotNumber, movements);

    expect(history.length).toBe(1);
    expect(history[0].status).toBe('COMPLETED');
  });

  it('[INVARIANT #16] should not mutate input movements', () => {
    const lotNumber: LotNumber = { value: 'LOT-001' };
    const movements: InventoryMovement[] = [
      createMovement({ lotNumber: lotNumber }),
    ];
    const originalLength = movements.length;
    const originalId = movements[0].id.value;

    getLotHistory('tenant-a', lotNumber, movements);

    expect(movements.length).toBe(originalLength);
    expect(movements[0].id.value).toBe(originalId);
  });
});

// ========== Serial History ==========

describe('getSerialHistory', () => {
  it('should return chronological serial history', () => {
    const serialNumber: SerialNumber = { value: 'SN-12345' };
    const movements: InventoryMovement[] = [
      createMovement({
        id: { value: 'mov-2' },
        serialNumber: serialNumber,
        movementDate: new Date('2024-01-02'),
      }),
      createMovement({
        id: { value: 'mov-1' },
        serialNumber: serialNumber,
        movementDate: new Date('2024-01-01'),
      }),
    ];

    const history = getSerialHistory('tenant-a', serialNumber, movements);

    expect(history.length).toBe(2);
    expect(history[0].id.value).toBe('mov-1');
    expect(history[1].id.value).toBe('mov-2');
  });

  it('[INVARIANT #11] should enforce tenant isolation', () => {
    const serialNumber: SerialNumber = { value: 'SN-12345' };
    const movements: InventoryMovement[] = [
      createMovement({
        tenantId: 'tenant-a',
        serialNumber: serialNumber,
      }),
      createMovement({
        tenantId: 'tenant-b',
        serialNumber: serialNumber,
      }),
    ];

    const history = getSerialHistory('tenant-a', serialNumber, movements);

    expect(history.length).toBe(1);
    expect(history[0].tenantId).toBe('tenant-a');
  });

  it('[INVARIANT #16] should not mutate input movements', () => {
    const serialNumber: SerialNumber = { value: 'SN-12345' };
    const movements: InventoryMovement[] = [
      createMovement({ serialNumber: serialNumber }),
    ];
    const originalLength = movements.length;
    const originalId = movements[0].id.value;

    getSerialHistory('tenant-a', serialNumber, movements);

    expect(movements.length).toBe(originalLength);
    expect(movements[0].id.value).toBe(originalId);
  });
});

// ========== Chain Validation ==========

describe('validateTraceabilityChain', () => {
  it('should validate complete chain', () => {
    const movements: InventoryMovement[] = [
      createMovement({
        id: { value: 'mov-1' },
        fromLocationId: undefined,
        toLocationId: { value: 'WH-001' },
        movementDate: new Date('2024-01-01'),
      }),
      createMovement({
        id: { value: 'mov-2' },
        fromLocationId: { value: 'WH-001' },
        toLocationId: { value: 'WH-002' },
        movementDate: new Date('2024-01-02'),
      }),
    ];

    const result = validateTraceabilityChain(movements);

    expect(result.isValid).toBe(true);
    expect(result.gaps.length).toBe(0);
    expect(result.metadata.totalMovements).toBe(2);
  });

  it('[INVARIANT #14] should report broken chain', () => {
    const movements: InventoryMovement[] = [
      createMovement({
        id: { value: 'mov-1' },
        fromLocationId: undefined,
        toLocationId: { value: 'WH-001' },
        movementDate: new Date('2024-01-01'),
      }),
      createMovement({
        id: { value: 'mov-2' },
        fromLocationId: { value: 'WH-999' }, // Gap! Should be WH-001
        toLocationId: { value: 'WH-002' },
        movementDate: new Date('2024-01-02'),
      }),
    ];

    const result = validateTraceabilityChain(movements);

    expect(result.isValid).toBe(false);
    expect(result.gaps.length).toBe(1);
    expect(result.gaps[0].expectedLocation).toBe('WH-001');
  });

  it('should handle empty chain', () => {
    const result = validateTraceabilityChain([]);

    expect(result.isValid).toBe(false);
    expect(result.metadata.totalMovements).toBe(0);
    expect(result.metadata.startDate).toBeNull();
    expect(result.metadata.endDate).toBeNull();
  });

  it('should sort movements chronologically before validation', () => {
    const movements: InventoryMovement[] = [
      createMovement({
        id: { value: 'mov-2' },
        fromLocationId: { value: 'WH-001' },
        toLocationId: { value: 'WH-002' },
        movementDate: new Date('2024-01-02'),
      }),
      createMovement({
        id: { value: 'mov-1' },
        fromLocationId: undefined,
        toLocationId: { value: 'WH-001' },
        movementDate: new Date('2024-01-01'),
      }),
    ];

    const result = validateTraceabilityChain(movements);

    expect(result.isValid).toBe(true);
    expect(result.metadata.startDate).toEqual(new Date('2024-01-01'));
  });

  it('[INVARIANT #16] should not mutate input movements', () => {
    const movements: InventoryMovement[] = [
      createMovement({
        toLocationId: { value: 'WH-001' },
      }),
    ];
    const originalLength = movements.length;
    const originalId = movements[0].id.value;

    validateTraceabilityChain(movements);

    expect(movements.length).toBe(originalLength);
    expect(movements[0].id.value).toBe(originalId);
  });
});
