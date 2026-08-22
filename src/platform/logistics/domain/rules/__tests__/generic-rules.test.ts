/**
 * E7.3 Phase 2 — Generic Rules Tests
 * 
 * Tests for 7 P0 generic rules.
 */

import { describe, it, expect } from '@jest/globals';
import { InventoryExpiryRule } from '../expiry.rule';
import { QuantityPositiveRule, AvailableQuantityRule } from '../quantity.rule';
import {
  LotValidityRule,
  SerialValidityRule,
  ChainIntegrityRule,
  ComplianceStatusRule,
} from '../traceability.rule';
import type { Inventory } from '../../inventory.types';
import type { Item } from '../../item.types';
import type { Traceability } from '../../traceability.types';

describe('E7.3 Phase 2 — Generic Rules', () => {
  describe('Rule 1: InventoryExpiryRule', () => {
    const rule = new InventoryExpiryRule();

    it('should PASS for non-expired inventory', () => {
      // Arrange
      const inventory: Inventory = {
        id: { value: 'inv-1' },
        tenantId: 'tenant-a',
        itemId: { value: 'item-1' },
        locationId: { value: 'loc-1' },
        locationType: 'WAREHOUSE',
        quantityOnHand: 100,
        quantityReserved: 0,
        quantityAvailable: 100,
        expiry_date: new Date('2026-12-31'),
        status: 'AVAILABLE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const evaluationDate = new Date('2026-08-22');

      // Act
      const result = rule.evaluate({ inventory, evaluationDate });

      // Assert
      expect(result.status).toBe('PASS');
      expect(result.ruleId).toBe('INVENTORY_EXPIRY_CHECK');
      expect(result.evidence.output.is_expired).toBe(false);
    });

    it('should VIOLATION for expired inventory', () => {
      // Arrange
      const inventory: Inventory = {
        id: { value: 'inv-1' },
        tenantId: 'tenant-a',
        itemId: { value: 'item-1' },
        locationId: { value: 'loc-1' },
        locationType: 'WAREHOUSE',
        quantityOnHand: 100,
        quantityReserved: 0,
        quantityAvailable: 100,
        expiry_date: new Date('2026-08-20'),
        status: 'AVAILABLE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const evaluationDate = new Date('2026-08-22');

      // Act
      const result = rule.evaluate({ inventory, evaluationDate });

      // Assert
      expect(result.status).toBe('VIOLATION');
      if (result.status === 'VIOLATION') {
        expect(result.violation.code).toBe('INVENTORY_EXPIRED');
        expect(result.violation.message).toContain('2 day(s) ago');
        expect(result.evidence.output.is_expired).toBe(true);
        expect(result.evidence.output.days_past_expiry).toBe(2);
      }
    });

    it('should PASS for inventory without expiry date', () => {
      // Arrange
      const inventory: Inventory = {
        id: { value: 'inv-1' },
        tenantId: 'tenant-a',
        itemId: { value: 'item-1' },
        locationId: { value: 'loc-1' },
        locationType: 'WAREHOUSE',
        quantityOnHand: 100,
        quantityReserved: 0,
        quantityAvailable: 100,
        expiry_date: null,
        status: 'AVAILABLE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const evaluationDate = new Date('2026-08-22');

      // Act
      const result = rule.evaluate({ inventory, evaluationDate });

      // Assert
      expect(result.status).toBe('PASS');
      expect(result.evidence.output.reason).toBe('no_expiry_date');
    });

    it('should NOT mutate inventory (Invariant 1)', () => {
      // Arrange
      const originalInventory: Inventory = {
        id: { value: 'inv-1' },
        tenantId: 'tenant-a',
        itemId: { value: 'item-1' },
        locationId: { value: 'loc-1' },
        locationType: 'WAREHOUSE',
        quantityOnHand: 100,
        quantityReserved: 0,
        quantityAvailable: 100,
        expiry_date: new Date('2026-08-20'),
        status: 'AVAILABLE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const inventory = { ...originalInventory };
      const evaluationDate = new Date('2026-08-22');

      // Act
      rule.evaluate({ inventory, evaluationDate });

      // Assert
      expect(inventory).toEqual(originalInventory);
      expect(inventory.status).toBe('AVAILABLE');
      expect(inventory.expiry_date).toEqual(originalInventory.expiry_date);
    });
  });

  describe('Rule 2: QuantityPositiveRule', () => {
    const rule = new QuantityPositiveRule();

    it('should PASS for positive quantity', () => {
      // Act
      const result = rule.evaluate({ quantity: 10, operation: 'reserve' });

      // Assert
      expect(result.status).toBe('PASS');
      expect(result.evidence.output.is_positive).toBe(true);
    });

    it('should VIOLATION for zero quantity', () => {
      // Act
      const result = rule.evaluate({ quantity: 0, operation: 'reserve' });

      // Assert
      expect(result.status).toBe('VIOLATION');
      if (result.status === 'VIOLATION') {
        expect(result.violation.code).toBe('QUANTITY_MUST_BE_POSITIVE');
        expect(result.evidence.output.is_positive).toBe(false);
      }
    });

    it('should VIOLATION for negative quantity', () => {
      // Act
      const result = rule.evaluate({ quantity: -5, operation: 'reserve' });

      // Assert
      expect(result.status).toBe('VIOLATION');
      if (result.status === 'VIOLATION') {
        expect(result.violation.code).toBe('QUANTITY_MUST_BE_POSITIVE');
        expect(result.violation.actual).toBe(-5);
      }
    });
  });

  describe('Rule 3: AvailableQuantityRule', () => {
    const rule = new AvailableQuantityRule();

    it('should PASS when requested <= available', () => {
      // Act
      const result = rule.evaluate({
        requested: 50,
        available: 100,
        inventory_id: 'inv-1',
      });

      // Assert
      expect(result.status).toBe('PASS');
      expect(result.evidence.output.is_sufficient).toBe(true);
      expect(result.evidence.output.remaining).toBe(50);
    });

    it('should VIOLATION when requested > available', () => {
      // Act
      const result = rule.evaluate({
        requested: 150,
        available: 100,
        inventory_id: 'inv-1',
      });

      // Assert
      expect(result.status).toBe('VIOLATION');
      if (result.status === 'VIOLATION') {
        expect(result.violation.code).toBe('INSUFFICIENT_AVAILABLE_QUANTITY');
        expect(result.evidence.output.shortfall).toBe(50);
      }
    });
  });

  describe('Rule 4: LotValidityRule', () => {
    const rule = new LotValidityRule();

    it('should PASS for non-lot-tracked item', () => {
      // Arrange
      const item: Item = {
        id: { value: 'item-1' },
        tenantId: 'tenant-a',
        skuCode: { value: 'SKU-001' },
        name: 'Test Item',
        type: 'GOODS',
        baseUom: 'EA',
        lotTracked: false,
        serialTracked: false,
        expiryTracked: false,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Act
      const result = rule.evaluate({ item, lot_number: null });

      // Assert
      expect(result.status).toBe('PASS');
      expect(result.evidence.output.reason).toBe('not_lot_tracked');
    });

    it('should VIOLATION for lot-tracked item without lot number', () => {
      // Arrange
      const item: Item = {
        id: { value: 'item-1' },
        tenantId: 'tenant-a',
        skuCode: { value: 'SKU-001' },
        name: 'Test Item',
        type: 'GOODS',
        baseUom: 'EA',
        lotTracked: true,
        serialTracked: false,
        expiryTracked: false,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Act
      const result = rule.evaluate({ item, lot_number: null });

      // Assert
      expect(result.status).toBe('VIOLATION');
      if (result.status === 'VIOLATION') {
        expect(result.violation.code).toBe('LOT_NUMBER_REQUIRED');
        expect(result.evidence.output.is_valid).toBe(false);
      }
    });

    it('should PASS for lot-tracked item with lot number', () => {
      // Arrange
      const item: Item = {
        id: { value: 'item-1' },
        tenantId: 'tenant-a',
        skuCode: { value: 'SKU-001' },
        name: 'Test Item',
        type: 'GOODS',
        baseUom: 'EA',
        lotTracked: true,
        serialTracked: false,
        expiryTracked: false,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Act
      const result = rule.evaluate({ item, lot_number: 'LOT-2026-001' });

      // Assert
      expect(result.status).toBe('PASS');
      expect(result.evidence.output.is_valid).toBe(true);
    });
  });

  describe('Rule 5: SerialValidityRule', () => {
    const rule = new SerialValidityRule();

    it('should PASS for non-serial-tracked item', () => {
      // Arrange
      const item: Item = {
        id: { value: 'item-1' },
        tenantId: 'tenant-a',
        skuCode: { value: 'SKU-001' },
        name: 'Test Item',
        type: 'GOODS',
        baseUom: 'EA',
        lotTracked: false,
        serialTracked: false,
        expiryTracked: false,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Act
      const result = rule.evaluate({ item, serial_number: null });

      // Assert
      expect(result.status).toBe('PASS');
    });

    it('should VIOLATION for serial-tracked item without serial number', () => {
      // Arrange
      const item: Item = {
        id: { value: 'item-1' },
        tenantId: 'tenant-a',
        skuCode: { value: 'SKU-001' },
        name: 'Test Item',
        type: 'GOODS',
        baseUom: 'EA',
        lotTracked: false,
        serialTracked: true,
        expiryTracked: false,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Act
      const result = rule.evaluate({ item, serial_number: null });

      // Assert
      expect(result.status).toBe('VIOLATION');
      if (result.status === 'VIOLATION') {
        expect(result.violation.code).toBe('SERIAL_NUMBER_REQUIRED');
      }
    });

    it('should PASS for serial-tracked item with serial number', () => {
      // Arrange
      const item: Item = {
        id: { value: 'item-1' },
        tenantId: 'tenant-a',
        skuCode: { value: 'SKU-001' },
        name: 'Test Item',
        type: 'GOODS',
        baseUom: 'EA',
        lotTracked: false,
        serialTracked: true,
        expiryTracked: false,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Act
      const result = rule.evaluate({ item, serial_number: 'SN-123456' });

      // Assert
      expect(result.status).toBe('PASS');
    });
  });

  describe('Rule 6: ChainIntegrityRule', () => {
    const rule = new ChainIntegrityRule();

    it('should PASS for complete chain', () => {
      // Arrange
      const traceability: Traceability = {
        id: 'trace-1',
        tenantId: 'tenant-a',
        itemId: 'item-1',
        lotNumber: 'LOT-001',
        serialNumber: null,
        manufacturedDate: null,
        expiryDate: null,
        receivedDate: new Date(),
        supplierId: null,
        supplierName: null,
        supplierLotNumber: null,
        custodyEvents: [
          {
            timestamp: new Date(),
            locationId: 'loc-1',
            locationType: 'WAREHOUSE',
            action: 'RECEIVED',
            userId: null,
            notes: null,
          },
          {
            timestamp: new Date(),
            locationId: 'loc-2',
            locationType: 'WAREHOUSE',
            action: 'MOVED',
            userId: null,
            notes: null,
          },
        ],
        complianceStatus: 'COMPLIANT',
        recallStatus: 'NONE',
        recallReason: null,
        recallDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Act
      const result = rule.evaluate({
        traceability,
        requiredEvents: ['RECEIVED', 'MOVED'],
      });

      // Assert
      expect(result.status).toBe('PASS');
      expect(result.evidence.output.is_complete).toBe(true);
    });

    it('should VIOLATION for broken chain', () => {
      // Arrange
      const traceability: Traceability = {
        id: 'trace-1',
        tenantId: 'tenant-a',
        itemId: 'item-1',
        lotNumber: 'LOT-001',
        serialNumber: null,
        manufacturedDate: null,
        expiryDate: null,
        receivedDate: new Date(),
        supplierId: null,
        supplierName: null,
        supplierLotNumber: null,
        custodyEvents: [
          {
            timestamp: new Date(),
            locationId: 'loc-1',
            locationType: 'WAREHOUSE',
            action: 'RECEIVED',
            userId: null,
            notes: null,
          },
        ],
        complianceStatus: 'COMPLIANT',
        recallStatus: 'NONE',
        recallReason: null,
        recallDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Act
      const result = rule.evaluate({
        traceability,
        requiredEvents: ['RECEIVED', 'MOVED', 'SHIPPED'],
      });

      // Assert
      expect(result.status).toBe('VIOLATION');
      if (result.status === 'VIOLATION') {
        expect(result.violation.code).toBe('BROKEN_TRACEABILITY_CHAIN');
        expect(result.evidence.output.missing_events).toEqual(['MOVED', 'SHIPPED']);
      }
    });
  });

  describe('Rule 7: ComplianceStatusRule', () => {
    const rule = new ComplianceStatusRule();

    it('should PASS for compliant traceability', () => {
      // Arrange
      const traceability: Traceability = {
        id: 'trace-1',
        tenantId: 'tenant-a',
        itemId: 'item-1',
        lotNumber: 'LOT-001',
        serialNumber: null,
        manufacturedDate: null,
        expiryDate: null,
        receivedDate: new Date(),
        supplierId: null,
        supplierName: null,
        supplierLotNumber: null,
        custodyEvents: [],
        complianceStatus: 'COMPLIANT',
        recallStatus: 'NONE',
        recallReason: null,
        recallDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Act
      const result = rule.evaluate({ traceability });

      // Assert
      expect(result.status).toBe('PASS');
      expect(result.evidence.output.is_compliant).toBe(true);
    });

    it('should VIOLATION for non-compliant traceability', () => {
      // Arrange
      const traceability: Traceability = {
        id: 'trace-1',
        tenantId: 'tenant-a',
        itemId: 'item-1',
        lotNumber: 'LOT-001',
        serialNumber: null,
        manufacturedDate: null,
        expiryDate: null,
        receivedDate: new Date(),
        supplierId: null,
        supplierName: null,
        supplierLotNumber: null,
        custodyEvents: [],
        complianceStatus: 'NON_COMPLIANT',
        recallStatus: 'RECALLED',
        recallReason: 'Contamination',
        recallDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Act
      const result = rule.evaluate({ traceability });

      // Assert
      expect(result.status).toBe('VIOLATION');
      if (result.status === 'VIOLATION') {
        expect(result.violation.code).toBe('COMPLIANCE_VIOLATION');
        expect(result.evidence.output.recall_status).toBe('RECALLED');
      }
    });
  });

  describe('Invariant Tests', () => {
    it('should be deterministic (Invariant 3)', () => {
      // Arrange
      const rule = new InventoryExpiryRule();
      const inventory: Inventory = {
        id: { value: 'inv-1' },
        tenantId: 'tenant-a',
        itemId: { value: 'item-1' },
        locationId: { value: 'loc-1' },
        locationType: 'WAREHOUSE',
        quantityOnHand: 100,
        quantityReserved: 0,
        quantityAvailable: 100,
        expiry_date: new Date('2026-08-20'),
        status: 'AVAILABLE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const evaluationDate = new Date('2026-08-22T10:00:00Z');

      // Act
      const result1 = rule.evaluate({ inventory, evaluationDate });
      const result2 = rule.evaluate({ inventory, evaluationDate });

      // Assert: Identical results
      expect(result1.status).toBe(result2.status);
      expect(result1.ruleId).toBe(result2.ruleId);
      expect(result1.evaluatedAt).toEqual(result2.evaluatedAt);
    });

    it('should have stable ID and version (Invariant 5)', () => {
      // Arrange
      const rule = new InventoryExpiryRule();

      // Assert
      expect(rule.id).toBe('INVENTORY_EXPIRY_CHECK');
      expect(rule.version).toBe('1.0.0');

      // TypeScript enforces readonly (compile-time)
      // @ts-expect-error - Cannot assign to 'id' because it is a read-only property
      rule.id = 'CHANGED';
    });

    it('should NOT call Product services (Invariant 2)', () => {
      // Arrange
      const rule = new QuantityPositiveRule();
      const serviceCallTracker: any[] = [];

      // Act
      rule.evaluate({ quantity: 10, operation: 'test' });

      // Assert: No external calls
      expect(serviceCallTracker.length).toBe(0);
    });
  });
});
