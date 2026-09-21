/**
 * Traceability Domain Tests
 * 
 * Test Coverage:
 * - 6 domain invariants
 * - Lot/Serial validation
 * - Date validation
 * - Chain of custody (append-only)
 * - Recall management
 * - Compliance status
 * - Result<T> error paths
 */

import { TraceabilityDomain } from '../traceability.domain';
import type { CreateTraceabilityProps, Traceability } from '../traceability.types';

describe('TraceabilityDomain', () => {
  const baseProps: CreateTraceabilityProps = {
    tenantId: 'tenant-1',
    itemId: 'item-1',
    lotNumber: 'LOT-001',
    receivedDate: new Date('2024-01-15'),
  };

  describe('create() - Invariant #1: Must have lot_number OR serial_number', () => {
    it('should fail if neither lot nor serial provided', () => {
      const props = {
        ...baseProps,
        lotNumber: undefined,
        serialNumber: undefined,
      };
      const result = TraceabilityDomain.create(props);

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Either lot number or serial number is required');
      expect(result.errorCode).toBe('TRACEABILITY_IDENTIFIER_REQUIRED');
    });

    it('should succeed with lot number only', () => {
      const props = {
        ...baseProps,
        lotNumber: 'LOT-001',
        serialNumber: undefined,
      };
      const result = TraceabilityDomain.create(props);

      expect(result.isSuccess).toBe(true);
      expect(result.value?.lotNumber).toBe('LOT-001');
      expect(result.value?.serialNumber).toBeNull();
    });

    it('should succeed with serial number only', () => {
      const props = {
        ...baseProps,
        lotNumber: undefined,
        serialNumber: 'SN-12345',
      };
      const result = TraceabilityDomain.create(props);

      expect(result.isSuccess).toBe(true);
      expect(result.value?.lotNumber).toBeNull();
      expect(result.value?.serialNumber).toBe('SN-12345');
    });

    it('should succeed with both lot and serial', () => {
      const props = {
        ...baseProps,
        lotNumber: 'LOT-001',
        serialNumber: 'SN-12345',
      };
      const result = TraceabilityDomain.create(props);

      expect(result.isSuccess).toBe(true);
      expect(result.value?.lotNumber).toBe('LOT-001');
      expect(result.value?.serialNumber).toBe('SN-12345');
    });
  });

  describe('create() - Invariant #2: Received date required', () => {
    it('should fail if received date is missing', () => {
      const props = {
        ...baseProps,
        receivedDate: undefined as any,
      };
      const result = TraceabilityDomain.create(props);

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Received date is required');
      expect(result.errorCode).toBe('TRACEABILITY_RECEIVED_DATE_REQUIRED');
    });

    it('should succeed with received date', () => {
      const receivedDate = new Date('2024-06-15');
      const props = {
        ...baseProps,
        receivedDate,
      };
      const result = TraceabilityDomain.create(props);

      expect(result.isSuccess).toBe(true);
      expect(result.value?.receivedDate).toEqual(receivedDate);
    });
  });

  describe('create() - Invariant #3: Expiry date must be after manufactured date', () => {
    it('should fail if expiry date equals manufactured date', () => {
      const date = new Date('2024-01-15');
      const props = {
        ...baseProps,
        manufacturedDate: date,
        expiryDate: date,
      };
      const result = TraceabilityDomain.create(props);

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Expiry date must be after manufactured date');
      expect(result.errorCode).toBe('TRACEABILITY_EXPIRY_BEFORE_MANUFACTURE');
    });

    it('should fail if expiry date before manufactured date', () => {
      const props = {
        ...baseProps,
        manufacturedDate: new Date('2024-01-20'),
        expiryDate: new Date('2024-01-15'),
      };
      const result = TraceabilityDomain.create(props);

      expect(result.isFailure).toBe(true);
      expect(result.errorCode).toBe('TRACEABILITY_EXPIRY_BEFORE_MANUFACTURE');
    });

    it('should succeed if expiry date after manufactured date', () => {
      const props = {
        ...baseProps,
        manufacturedDate: new Date('2024-01-15'),
        expiryDate: new Date('2025-01-15'),
      };
      const result = TraceabilityDomain.create(props);

      expect(result.isSuccess).toBe(true);
      expect(result.value?.manufacturedDate).toEqual(new Date('2024-01-15'));
      expect(result.value?.expiryDate).toEqual(new Date('2025-01-15'));
    });

    it('should succeed if only expiry date provided (no manufacture date)', () => {
      const props = {
        ...baseProps,
        manufacturedDate: undefined,
        expiryDate: new Date('2025-01-15'),
      };
      const result = TraceabilityDomain.create(props);

      expect(result.isSuccess).toBe(true);
      expect(result.value?.expiryDate).toEqual(new Date('2025-01-15'));
    });

    it('should succeed if only manufacture date provided (no expiry)', () => {
      const props = {
        ...baseProps,
        manufacturedDate: new Date('2024-01-15'),
        expiryDate: undefined,
      };
      const result = TraceabilityDomain.create(props);

      expect(result.isSuccess).toBe(true);
      expect(result.value?.manufacturedDate).toEqual(new Date('2024-01-15'));
    });
  });

  describe('addCustodyEvent() - Invariant #4: Chain of custody is append-only', () => {
    let traceability: Traceability;

    beforeEach(() => {
      const createResult = TraceabilityDomain.create(baseProps);
      traceability = createResult.value!;
    });

    it('should fail if location ID missing', () => {
      const result = TraceabilityDomain.addCustodyEvent(traceability, {
        locationId: '' as any,
        action: 'RECEIVED',
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Location ID is required for custody event');
      expect(result.errorCode).toBe('CUSTODY_EVENT_LOCATION_REQUIRED');
    });

    it('should fail if action missing', () => {
      const result = TraceabilityDomain.addCustodyEvent(traceability, {
        locationId: 'loc-1',
        action: '',
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Action is required for custody event');
      expect(result.errorCode).toBe('CUSTODY_EVENT_ACTION_REQUIRED');
    });

    it('should add custody event', () => {
      const result = TraceabilityDomain.addCustodyEvent(traceability, {
        locationId: 'loc-1',
        locationType: 'WAREHOUSE',
        action: 'RECEIVED',
        userId: 'user-1',
        notes: 'Initial receipt',
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value?.custodyEvents.length).toBe(1);
      expect(result.value?.custodyEvents[0].locationId).toBe('loc-1');
      expect(result.value?.custodyEvents[0].action).toBe('RECEIVED');
    });

    it('should append events (not replace)', () => {
      let current = traceability;

      const result1 = TraceabilityDomain.addCustodyEvent(current, {
        locationId: 'loc-1',
        action: 'RECEIVED',
      });
      current = result1.value!;

      const result2 = TraceabilityDomain.addCustodyEvent(current, {
        locationId: 'loc-2',
        action: 'TRANSFERRED',
      });
      current = result2.value!;

      const result3 = TraceabilityDomain.addCustodyEvent(current, {
        locationId: 'loc-3',
        action: 'SHIPPED',
      });
      current = result3.value!;

      expect(current.custodyEvents.length).toBe(3);
      expect(current.custodyEvents[0].action).toBe('RECEIVED');
      expect(current.custodyEvents[1].action).toBe('TRANSFERRED');
      expect(current.custodyEvents[2].action).toBe('SHIPPED');
    });

    it('should preserve existing events when adding new event', () => {
      const result1 = TraceabilityDomain.addCustodyEvent(traceability, {
        locationId: 'loc-1',
        action: 'RECEIVED',
        notes: 'First event',
      });
      const updated1 = result1.value!;

      const result2 = TraceabilityDomain.addCustodyEvent(updated1, {
        locationId: 'loc-2',
        action: 'TRANSFERRED',
        notes: 'Second event',
      });
      const updated2 = result2.value!;

      // Verify first event still intact
      expect(updated2.custodyEvents[0].locationId).toBe('loc-1');
      expect(updated2.custodyEvents[0].action).toBe('RECEIVED');
      expect(updated2.custodyEvents[0].notes).toBe('First event');

      // Verify second event added
      expect(updated2.custodyEvents[1].locationId).toBe('loc-2');
      expect(updated2.custodyEvents[1].action).toBe('TRANSFERRED');
      expect(updated2.custodyEvents[1].notes).toBe('Second event');
    });

    it('should trim action and notes', () => {
      const result = TraceabilityDomain.addCustodyEvent(traceability, {
        locationId: 'loc-1',
        action: '  RECEIVED  ',
        notes: '  Test notes  ',
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value?.custodyEvents[0].action).toBe('RECEIVED');
      expect(result.value?.custodyEvents[0].notes).toBe('Test notes');
    });
  });

  describe('initiateRecall() - Invariant #5: Only NONE status can be recalled', () => {
    let traceability: Traceability;

    beforeEach(() => {
      const createResult = TraceabilityDomain.create(baseProps);
      traceability = createResult.value!;
    });

    it('should fail if recall reason missing', () => {
      const result = TraceabilityDomain.initiateRecall(traceability, '');

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Recall reason is required');
      expect(result.errorCode).toBe('TRACEABILITY_RECALL_REASON_REQUIRED');
    });

    it('should recall item with NONE status', () => {
      expect(traceability.recallStatus).toBe('NONE');

      const result = TraceabilityDomain.initiateRecall(
        traceability,
        'Contamination detected'
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value?.recallStatus).toBe('RECALLED');
      expect(result.value?.recallReason).toBe('Contamination detected');
      expect(result.value?.recallDate).toBeDefined();
      expect(result.value?.complianceStatus).toBe('NON_COMPLIANT');
    });

    it('should fail if already recalled', () => {
      const recallResult = TraceabilityDomain.initiateRecall(
        traceability,
        'First recall'
      );
      const recalled = recallResult.value!;

      const result = TraceabilityDomain.initiateRecall(recalled, 'Second recall');

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Cannot recall item already in status RECALLED');
      expect(result.errorCode).toBe('TRACEABILITY_ALREADY_RECALLED');
    });

    it('should trim recall reason', () => {
      const result = TraceabilityDomain.initiateRecall(
        traceability,
        '  Contamination  '
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value?.recallReason).toBe('Contamination');
    });
  });

  describe('markAsDestroyed() - Invariant #6: Only RECALLED items can be destroyed', () => {
    let traceability: Traceability;

    beforeEach(() => {
      const createResult = TraceabilityDomain.create(baseProps);
      traceability = createResult.value!;
    });

    it('should fail if item not recalled', () => {
      expect(traceability.recallStatus).toBe('NONE');

      const result = TraceabilityDomain.markAsDestroyed(traceability);

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Only recalled items can be marked as destroyed');
      expect(result.errorCode).toBe('TRACEABILITY_NOT_RECALLED');
    });

    it('should mark recalled item as destroyed', () => {
      const recallResult = TraceabilityDomain.initiateRecall(
        traceability,
        'Contamination'
      );
      const recalled = recallResult.value!;

      const result = TraceabilityDomain.markAsDestroyed(recalled);

      expect(result.isSuccess).toBe(true);
      expect(result.value?.recallStatus).toBe('DESTROYED');
    });

    it('should fail if destroyed item destroyed again', () => {
      const recallResult = TraceabilityDomain.initiateRecall(traceability, 'Test');
      const recalled = recallResult.value!;

      const destroyResult = TraceabilityDomain.markAsDestroyed(recalled);
      const destroyed = destroyResult.value!;

      const result = TraceabilityDomain.markAsDestroyed(destroyed);

      expect(result.isFailure).toBe(true);
      expect(result.errorCode).toBe('TRACEABILITY_NOT_RECALLED');
    });
  });

  describe('changeComplianceStatus()', () => {
    let traceability: Traceability;

    beforeEach(() => {
      const createResult = TraceabilityDomain.create(baseProps);
      traceability = createResult.value!;
    });

    it('should change compliance status', () => {
      const result = TraceabilityDomain.changeComplianceStatus(
        traceability,
        'NON_COMPLIANT'
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value?.complianceStatus).toBe('NON_COMPLIANT');
    });

    it('should fail to mark recalled item as compliant', () => {
      const recallResult = TraceabilityDomain.initiateRecall(traceability, 'Test');
      const recalled = recallResult.value!;

      const result = TraceabilityDomain.changeComplianceStatus(recalled, 'COMPLIANT');

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Cannot mark recalled/destroyed item as compliant');
      expect(result.errorCode).toBe('TRACEABILITY_CANNOT_MARK_RECALLED_COMPLIANT');
    });

    it('should fail to mark destroyed item as compliant', () => {
      const recallResult = TraceabilityDomain.initiateRecall(traceability, 'Test');
      const recalled = recallResult.value!;
      const destroyResult = TraceabilityDomain.markAsDestroyed(recalled);
      const destroyed = destroyResult.value!;

      const result = TraceabilityDomain.changeComplianceStatus(destroyed, 'COMPLIANT');

      expect(result.isFailure).toBe(true);
      expect(result.errorCode).toBe('TRACEABILITY_CANNOT_MARK_RECALLED_COMPLIANT');
    });

    it('should allow marking recalled item as non-compliant', () => {
      const recallResult = TraceabilityDomain.initiateRecall(traceability, 'Test');
      const recalled = recallResult.value!;

      const result = TraceabilityDomain.changeComplianceStatus(
        recalled,
        'NON_COMPLIANT'
      );

      expect(result.isSuccess).toBe(true);
    });
  });

  describe('Query methods', () => {
    let traceability: Traceability;

    beforeEach(() => {
      const createResult = TraceabilityDomain.create(baseProps);
      traceability = createResult.value!;
    });

    it('should correctly identify recalled status', () => {
      expect(TraceabilityDomain.isRecalled(traceability)).toBe(false);

      const recallResult = TraceabilityDomain.initiateRecall(traceability, 'Test');
      const recalled = recallResult.value!;

      expect(TraceabilityDomain.isRecalled(recalled)).toBe(true);
    });

    it('should correctly identify destroyed status', () => {
      expect(TraceabilityDomain.isDestroyed(traceability)).toBe(false);

      const recallResult = TraceabilityDomain.initiateRecall(traceability, 'Test');
      const recalled = recallResult.value!;

      expect(TraceabilityDomain.isDestroyed(recalled)).toBe(false);

      const destroyResult = TraceabilityDomain.markAsDestroyed(recalled);
      const destroyed = destroyResult.value!;

      expect(TraceabilityDomain.isDestroyed(destroyed)).toBe(true);
      expect(TraceabilityDomain.isRecalled(destroyed)).toBe(true); // Destroyed is also recalled
    });

    it('should correctly identify compliance status', () => {
      expect(TraceabilityDomain.isCompliant(traceability)).toBe(true);

      const changeResult = TraceabilityDomain.changeComplianceStatus(
        traceability,
        'NON_COMPLIANT'
      );
      const nonCompliant = changeResult.value!;

      expect(TraceabilityDomain.isCompliant(nonCompliant)).toBe(false);
    });
  });

  describe('Expiry calculations', () => {
    it('should detect expired items', () => {
      const props = {
        ...baseProps,
        expiryDate: new Date('2024-01-01'),
      };
      const createResult = TraceabilityDomain.create(props);
      const trace = createResult.value!;

      const referenceDate = new Date('2024-06-15');
      expect(TraceabilityDomain.hasExpired(trace, referenceDate)).toBe(true);
    });

    it('should detect non-expired items', () => {
      const props = {
        ...baseProps,
        expiryDate: new Date('2025-12-31'),
      };
      const createResult = TraceabilityDomain.create(props);
      const trace = createResult.value!;

      const referenceDate = new Date('2024-06-15');
      expect(TraceabilityDomain.hasExpired(trace, referenceDate)).toBe(false);
    });

    it('should return false if no expiry date', () => {
      const props = {
        ...baseProps,
        expiryDate: undefined,
      };
      const createResult = TraceabilityDomain.create(props);
      const trace = createResult.value!;

      expect(TraceabilityDomain.hasExpired(trace)).toBe(false);
    });

    it('should calculate days until expiry', () => {
      const props = {
        ...baseProps,
        expiryDate: new Date('2024-07-15'),
      };
      const createResult = TraceabilityDomain.create(props);
      const trace = createResult.value!;

      const referenceDate = new Date('2024-06-15');
      const days = TraceabilityDomain.daysUntilExpiry(trace, referenceDate);

      expect(days).toBe(30);
    });

    it('should return negative days for expired items', () => {
      const props = {
        ...baseProps,
        expiryDate: new Date('2024-05-15'),
      };
      const createResult = TraceabilityDomain.create(props);
      const trace = createResult.value!;

      const referenceDate = new Date('2024-06-15');
      const days = TraceabilityDomain.daysUntilExpiry(trace, referenceDate);

      expect(days).toBeLessThan(0);
    });

    it('should return null if no expiry date', () => {
      const props = {
        ...baseProps,
        expiryDate: undefined,
      };
      const createResult = TraceabilityDomain.create(props);
      const trace = createResult.value!;

      expect(TraceabilityDomain.daysUntilExpiry(trace)).toBeNull();
    });

    it('should detect near expiry items', () => {
      const props = {
        ...baseProps,
        expiryDate: new Date('2024-07-10'), // 25 days from reference
      };
      const createResult = TraceabilityDomain.create(props);
      const trace = createResult.value!;

      const referenceDate = new Date('2024-06-15');
      expect(TraceabilityDomain.isNearExpiry(trace, 30, referenceDate)).toBe(true);
      expect(TraceabilityDomain.isNearExpiry(trace, 20, referenceDate)).toBe(false);
    });

    it('should not mark expired items as near expiry', () => {
      const props = {
        ...baseProps,
        expiryDate: new Date('2024-05-15'),
      };
      const createResult = TraceabilityDomain.create(props);
      const trace = createResult.value!;

      const referenceDate = new Date('2024-06-15');
      expect(TraceabilityDomain.isNearExpiry(trace, 30, referenceDate)).toBe(false);
    });
  });

  describe('Custody chain helpers', () => {
    let traceability: Traceability;

    beforeEach(() => {
      const createResult = TraceabilityDomain.create(baseProps);
      traceability = createResult.value!;
    });

    it('should return empty custody chain for new item', () => {
      const chain = TraceabilityDomain.getCustodyChain(traceability);
      expect(chain).toEqual([]);
    });

    it('should return custody event count', () => {
      expect(TraceabilityDomain.getCustodyEventCount(traceability)).toBe(0);

      const result1 = TraceabilityDomain.addCustodyEvent(traceability, {
        locationId: 'loc-1',
        action: 'RECEIVED',
      });
      expect(TraceabilityDomain.getCustodyEventCount(result1.value!)).toBe(1);

      const result2 = TraceabilityDomain.addCustodyEvent(result1.value!, {
        locationId: 'loc-2',
        action: 'TRANSFERRED',
      });
      expect(TraceabilityDomain.getCustodyEventCount(result2.value!)).toBe(2);
    });

    it('should get last custody event', () => {
      expect(TraceabilityDomain.getLastCustodyEvent(traceability)).toBeNull();

      const result1 = TraceabilityDomain.addCustodyEvent(traceability, {
        locationId: 'loc-1',
        action: 'RECEIVED',
      });

      const last1 = TraceabilityDomain.getLastCustodyEvent(result1.value!);
      expect(last1?.action).toBe('RECEIVED');

      const result2 = TraceabilityDomain.addCustodyEvent(result1.value!, {
        locationId: 'loc-2',
        action: 'SHIPPED',
      });

      const last2 = TraceabilityDomain.getLastCustodyEvent(result2.value!);
      expect(last2?.action).toBe('SHIPPED');
    });

    it('should format custody chain', () => {
      let current = traceability;

      const result1 = TraceabilityDomain.addCustodyEvent(current, {
        locationId: 'loc-1',
        locationType: 'WAREHOUSE',
        action: 'RECEIVED',
        notes: 'Initial receipt',
      });
      current = result1.value!;

      const chain = TraceabilityDomain.getCustodyChain(current);
      expect(chain.length).toBe(1);
      expect(chain[0]).toContain('RECEIVED');
      expect(chain[0]).toContain('WAREHOUSE');
      expect(chain[0]).toContain('Initial receipt');
    });
  });

  describe('Shelf life calculations', () => {
    it('should calculate shelf life remaining', () => {
      const props = {
        ...baseProps,
        manufacturedDate: new Date('2024-01-01'),
        expiryDate: new Date('2025-01-01'), // 365 days shelf life
      };
      const createResult = TraceabilityDomain.create(props);
      const trace = createResult.value!;

      const referenceDate = new Date('2024-07-02'); // ~182 days elapsed (half)
      const remaining = TraceabilityDomain.getShelfLifeRemaining(trace, referenceDate);

      expect(remaining).toBeCloseTo(50, 0); // ~50% remaining
    });

    it('should return null if no manufacture date', () => {
      const props = {
        ...baseProps,
        manufacturedDate: undefined,
        expiryDate: new Date('2025-01-01'),
      };
      const createResult = TraceabilityDomain.create(props);
      const trace = createResult.value!;

      expect(TraceabilityDomain.getShelfLifeRemaining(trace)).toBeNull();
    });

    it('should return null if no expiry date', () => {
      const props = {
        ...baseProps,
        manufacturedDate: new Date('2024-01-01'),
        expiryDate: undefined,
      };
      const createResult = TraceabilityDomain.create(props);
      const trace = createResult.value!;

      expect(TraceabilityDomain.getShelfLifeRemaining(trace)).toBeNull();
    });

    it('should return 0% for expired items', () => {
      const props = {
        ...baseProps,
        manufacturedDate: new Date('2024-01-01'),
        expiryDate: new Date('2024-06-01'),
      };
      const createResult = TraceabilityDomain.create(props);
      const trace = createResult.value!;

      const referenceDate = new Date('2024-12-31');
      const remaining = TraceabilityDomain.getShelfLifeRemaining(trace, referenceDate);

      expect(remaining).toBe(0);
    });

    it('should return 100% at manufacture date', () => {
      const props = {
        ...baseProps,
        manufacturedDate: new Date('2024-01-01'),
        expiryDate: new Date('2025-01-01'),
      };
      const createResult = TraceabilityDomain.create(props);
      const trace = createResult.value!;

      const referenceDate = new Date('2024-01-01');
      const remaining = TraceabilityDomain.getShelfLifeRemaining(trace, referenceDate);

      expect(remaining).toBe(100);
    });
  });

  describe('Tenant isolation', () => {
    it('should preserve tenant ID', () => {
      const props = {
        ...baseProps,
        tenantId: 'tenant-abc-123',
      };
      const result = TraceabilityDomain.create(props);

      expect(result.isSuccess).toBe(true);
      expect(result.value?.tenantId).toBe('tenant-abc-123');
    });

    it('should preserve tenant ID through recall', () => {
      const props = {
        ...baseProps,
        tenantId: 'tenant-xyz',
      };
      const createResult = TraceabilityDomain.create(props);
      const recallResult = TraceabilityDomain.initiateRecall(
        createResult.value!,
        'Test'
      );

      expect(recallResult.value?.tenantId).toBe('tenant-xyz');
    });

    it('should preserve tenant ID through custody events', () => {
      const props = {
        ...baseProps,
        tenantId: 'tenant-xyz',
      };
      const createResult = TraceabilityDomain.create(props);
      const custodyResult = TraceabilityDomain.addCustodyEvent(createResult.value!, {
        locationId: 'loc-1',
        action: 'RECEIVED',
      });

      expect(custodyResult.value?.tenantId).toBe('tenant-xyz');
    });
  });

  describe('Supplier information', () => {
    it('should store supplier information', () => {
      const props = {
        ...baseProps,
        supplierId: 'supplier-1',
        supplierName: 'Acme Corp',
        supplierLotNumber: 'SUPPLIER-LOT-123',
      };
      const result = TraceabilityDomain.create(props);

      expect(result.isSuccess).toBe(true);
      expect(result.value?.supplierId).toBe('supplier-1');
      expect(result.value?.supplierName).toBe('Acme Corp');
      expect(result.value?.supplierLotNumber).toBe('SUPPLIER-LOT-123');
    });

    it('should handle missing supplier information', () => {
      const props = {
        ...baseProps,
        supplierId: undefined,
        supplierName: undefined,
        supplierLotNumber: undefined,
      };
      const result = TraceabilityDomain.create(props);

      expect(result.isSuccess).toBe(true);
      expect(result.value?.supplierId).toBeNull();
      expect(result.value?.supplierName).toBeNull();
      expect(result.value?.supplierLotNumber).toBeNull();
    });
  });

  describe('Edge cases and boundary values', () => {
    it('should handle very long lot numbers', () => {
      const longLot = 'A'.repeat(1000);
      const props = {
        ...baseProps,
        lotNumber: longLot,
      };
      const result = TraceabilityDomain.create(props);

      expect(result.isSuccess).toBe(true);
      expect(result.value?.lotNumber).toBe(longLot);
    });

    it('should handle very long serial numbers', () => {
      const longSerial = 'B'.repeat(1000);
      const props = {
        ...baseProps,
        serialNumber: longSerial,
      };
      const result = TraceabilityDomain.create(props);

      expect(result.isSuccess).toBe(true);
      expect(result.value?.serialNumber).toBe(longSerial);
    });

    it('should handle dates far in the future', () => {
      const props = {
        ...baseProps,
        expiryDate: new Date('2099-12-31'),
      };
      const result = TraceabilityDomain.create(props);

      expect(result.isSuccess).toBe(true);
      expect(result.value?.expiryDate).toEqual(new Date('2099-12-31'));
    });

    it('should handle dates in the past', () => {
      const props = {
        ...baseProps,
        manufacturedDate: new Date('1990-01-01'),
        receivedDate: new Date('1990-02-01'),
      };
      const result = TraceabilityDomain.create(props);

      expect(result.isSuccess).toBe(true);
    });

    it('should set timestamps correctly', () => {
      const before = new Date();
      const result = TraceabilityDomain.create(baseProps);
      const after = new Date();

      expect(result.isSuccess).toBe(true);
      const trace = result.value!;
      
      expect(trace.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(trace.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(trace.updatedAt).toEqual(trace.createdAt);
    });

    it('should update updatedAt on custody event', () => {
      const createResult = TraceabilityDomain.create(baseProps);
      const original = createResult.value!;
      const originalUpdated = original.updatedAt;

      // Wait a tiny bit to ensure timestamp difference
      const custodyResult = TraceabilityDomain.addCustodyEvent(original, {
        locationId: 'loc-1',
        action: 'RECEIVED',
      });

      expect(custodyResult.value?.updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalUpdated.getTime()
      );
    });
  });
});
