/**
 * Clinical Order Entity Domain Tests
 * 
 * Tests domain logic, invariants, state transitions, and business rules.
 * Does NOT test infrastructure (DB, event bus) - pure domain testing.
 * 
 * Test Coverage Target: 20+ tests
 * 
 * @module platform/healthcare/engines/order-engine/domain/__tests__
 */

import {
  ClinicalOrder,
  MissingRequiredFieldError,
  InvalidStateTransitionError,
  OrderAlreadyFinishedError,
  OrderNotApprovableError,
  OrderNotDiscontinuableError,
  CdsCheckBlockedError,
} from '../clinical-order.entity';
import type {
  OrderType,
  OrderPriority,
  MedicationOrderDetails,
} from '../../../contracts/order-engine.contract';

describe('ClinicalOrder Entity', () => {
  // ==========================================================================
  // Test Fixtures
  // ==========================================================================

  const validMedicationOrderDetails: MedicationOrderDetails = {
    drugCode: 'C01DX01',
    drugName: 'Digoxin',
    dose: 0.25,
    doseUnit: 'mg',
    route: 'PO',
    frequency: 'QD',
    currentMedicationCodes: [],
  };

  const createValidOrderData = () => ({
    tenantId: '10000000-0000-0000-0000-000000000001',
    encounterId: '40000000-0000-0000-0000-000000000001',
    patientId: '20000000-0000-0000-0000-000000000001',
    orderType: 'MEDICATION' as OrderType,
    priority: 'ROUTINE' as OrderPriority,
    orderedBy: '30000000-0000-0000-0000-000000000001',
    orderDetails: validMedicationOrderDetails,
    notes: 'Test order',
  });

  // ==========================================================================
  // Creation & Invariants
  // ==========================================================================

  describe('Order Creation', () => {
    it('should create order with valid data', () => {
      const data = createValidOrderData();
      const order = ClinicalOrder.create(data);

      expect(order.id).toBeDefined();
      expect(order.tenantId).toBe(data.tenantId);
      expect(order.encounterId).toBe(data.encounterId);
      expect(order.patientId).toBe(data.patientId);
      expect(order.orderType).toBe('MEDICATION');
      expect(order.orderStatus).toBe('PENDING');
      expect(order.priority).toBe('ROUTINE');
      expect(order.version).toBe(1);
    });

    it('should generate UUID for order ID', () => {
      const order = ClinicalOrder.create(createValidOrderData());
      expect(order.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should set timestamps on creation', () => {
      const beforeCreate = new Date();
      const order = ClinicalOrder.create(createValidOrderData());
      const afterCreate = new Date();

      expect(order.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
      expect(order.createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
      expect(order.updatedAt.getTime()).toBe(order.createdAt.getTime());
      expect(order.orderedAt.getTime()).toBe(order.createdAt.getTime());
    });

    it('should throw error if tenantId missing', () => {
      const data = { ...createValidOrderData(), tenantId: '' };
      expect(() => ClinicalOrder.create(data)).toThrow(MissingRequiredFieldError);
      expect(() => ClinicalOrder.create(data)).toThrow('tenantId');
    });

    it('should throw error if encounterId missing', () => {
      const data = { ...createValidOrderData(), encounterId: '' };
      expect(() => ClinicalOrder.create(data)).toThrow(MissingRequiredFieldError);
      expect(() => ClinicalOrder.create(data)).toThrow('encounterId');
    });

    it('should throw error if patientId missing', () => {
      const data = { ...createValidOrderData(), patientId: '' };
      expect(() => ClinicalOrder.create(data)).toThrow(MissingRequiredFieldError);
      expect(() => ClinicalOrder.create(data)).toThrow('patientId');
    });

    it('should throw error if orderedBy missing', () => {
      const data = { ...createValidOrderData(), orderedBy: '' };
      expect(() => ClinicalOrder.create(data)).toThrow(MissingRequiredFieldError);
      expect(() => ClinicalOrder.create(data)).toThrow('orderedBy');
    });

    it('should allow optional notes', () => {
      const data = { ...createValidOrderData(), notes: undefined };
      const order = ClinicalOrder.create(data);
      expect(order.notes).toBeUndefined();
    });

    it('should allow optional cdsCheckStatus', () => {
      const data = { ...createValidOrderData(), cdsCheckStatus: 'PASSED' as const };
      const order = ClinicalOrder.create(data);
      expect(order.cdsCheckStatus).toBe('PASSED');
    });
  });

  // ==========================================================================
  // State Transitions - Happy Path
  // ==========================================================================

  describe('State Transitions - Happy Path', () => {
    it('should transition PENDING → VALIDATED', () => {
      const order = ClinicalOrder.create(createValidOrderData());
      expect(order.orderStatus).toBe('PENDING');

      order.validate('PASSED', 0);
      expect(order.orderStatus).toBe('VALIDATED');
      expect(order.cdsCheckStatus).toBe('PASSED');
      expect(order.version).toBe(2);
    });

    it('should transition VALIDATED → APPROVED', () => {
      const order = ClinicalOrder.create(createValidOrderData());
      order.validate('PASSED', 0);

      const approvedBy = '30000000-0000-0000-0000-000000000002';
      order.approve(approvedBy);
      
      expect(order.orderStatus).toBe('APPROVED');
      expect(order.approvedBy).toBe(approvedBy);
      expect(order.approvedAt).toBeDefined();
      expect(order.version).toBe(3);
    });

    it('should transition APPROVED → ACTIVE', () => {
      const order = ClinicalOrder.create(createValidOrderData());
      order.validate('PASSED', 0);
      order.approve('doctor-uuid');

      order.activate();
      expect(order.orderStatus).toBe('ACTIVE');
      expect(order.version).toBe(4);
    });

    it('should transition ACTIVE → COMPLETED', () => {
      const order = ClinicalOrder.create(createValidOrderData());
      order.validate('PASSED', 0);
      order.approve('doctor-uuid');
      order.activate();

      order.complete();
      expect(order.orderStatus).toBe('COMPLETED');
      expect(order.version).toBe(5);
    });

    it('should transition PENDING → REJECTED', () => {
      const order = ClinicalOrder.create(createValidOrderData());

      order.reject('BLOCKED', 2);
      expect(order.orderStatus).toBe('REJECTED');
      expect(order.cdsCheckStatus).toBe('BLOCKED');
      expect(order.version).toBe(2);
    });

    it('should transition APPROVED → DISCONTINUED', () => {
      const order = ClinicalOrder.create(createValidOrderData());
      order.validate('PASSED', 0);
      order.approve('doctor-uuid');

      order.discontinue('doctor-uuid', 'Patient condition improved');
      expect(order.orderStatus).toBe('DISCONTINUED');
      expect(order.discontinuedBy).toBe('doctor-uuid');
      expect(order.discontinuedAt).toBeDefined();
      expect(order.discontinueReason).toBe('Patient condition improved');
      expect(order.version).toBe(4);
    });

    it('should transition ACTIVE → DISCONTINUED', () => {
      const order = ClinicalOrder.create(createValidOrderData());
      order.validate('PASSED', 0);
      order.approve('doctor-uuid');
      order.activate();

      order.discontinue('doctor-uuid', 'Adverse reaction observed');
      expect(order.orderStatus).toBe('DISCONTINUED');
      expect(order.version).toBe(5);
    });
  });

  // ==========================================================================
  // State Transitions - Invalid Transitions
  // ==========================================================================

  describe('State Transitions - Invalid Transitions', () => {
    it('should reject validate() if not PENDING', () => {
      const order = ClinicalOrder.create(createValidOrderData());
      order.validate('PASSED', 0); // Now VALIDATED

      expect(() => order.validate('PASSED', 0)).toThrow(InvalidStateTransitionError);
      expect(() => order.validate('PASSED', 0)).toThrow('VALIDATED to VALIDATED');
    });

    it('should reject approve() if not VALIDATED', () => {
      const order = ClinicalOrder.create(createValidOrderData());
      // Still PENDING

      expect(() => order.approve('doctor-uuid')).toThrow(OrderNotApprovableError);
    });

    it('should reject activate() if not APPROVED', () => {
      const order = ClinicalOrder.create(createValidOrderData());
      order.validate('PASSED', 0); // Still VALIDATED

      expect(() => order.activate()).toThrow(InvalidStateTransitionError);
      expect(() => order.activate()).toThrow('VALIDATED to ACTIVE');
    });

    it('should reject complete() if not ACTIVE', () => {
      const order = ClinicalOrder.create(createValidOrderData());
      order.validate('PASSED', 0);
      order.approve('doctor-uuid'); // Still APPROVED

      expect(() => order.complete()).toThrow(InvalidStateTransitionError);
      expect(() => order.complete()).toThrow('APPROVED to COMPLETED');
    });

    it('should reject reject() if not PENDING', () => {
      const order = ClinicalOrder.create(createValidOrderData());
      order.validate('PASSED', 0); // Now VALIDATED

      expect(() => order.reject('BLOCKED', 1)).toThrow(InvalidStateTransitionError);
    });

    it('should reject discontinue() if PENDING', () => {
      const order = ClinicalOrder.create(createValidOrderData());
      // Still PENDING

      expect(() => order.discontinue('doctor-uuid', 'Test reason')).toThrow(OrderNotDiscontinuableError);
    });

    it('should reject discontinue() if VALIDATED', () => {
      const order = ClinicalOrder.create(createValidOrderData());
      order.validate('PASSED', 0);

      expect(() => order.discontinue('doctor-uuid', 'Test reason')).toThrow(OrderNotDiscontinuableError);
    });
  });

  // ==========================================================================
  // Terminal State Protection
  // ==========================================================================

  describe('Terminal State Protection', () => {
    it('should reject modifications if COMPLETED', () => {
      const order = ClinicalOrder.create(createValidOrderData());
      order.validate('PASSED', 0);
      order.approve('doctor-uuid');
      order.activate();
      order.complete(); // Terminal state

      expect(order.isInTerminalState()).toBe(true);
      expect(() => order.approve('another-doctor')).toThrow(OrderAlreadyFinishedError);
      expect(() => order.discontinue('doctor-uuid', 'Test')).toThrow(OrderAlreadyFinishedError);
    });

    it('should reject modifications if DISCONTINUED', () => {
      const order = ClinicalOrder.create(createValidOrderData());
      order.validate('PASSED', 0);
      order.approve('doctor-uuid');
      order.discontinue('doctor-uuid', 'Cancelled'); // Terminal state

      expect(order.isInTerminalState()).toBe(true);
      expect(() => order.activate()).toThrow(InvalidStateTransitionError);
      expect(() => order.approve('another-doctor')).toThrow(OrderAlreadyFinishedError);
    });

    it('should reject modifications if REJECTED', () => {
      const order = ClinicalOrder.create(createValidOrderData());
      order.reject('BLOCKED', 1); // Terminal state

      expect(order.isInTerminalState()).toBe(true);
      expect(() => order.validate('PASSED', 0)).toThrow(InvalidStateTransitionError);
      expect(() => order.approve('doctor-uuid')).toThrow(OrderAlreadyFinishedError);
    });
  });

  // ==========================================================================
  // CDS Validation Rules
  // ==========================================================================

  describe('CDS Validation Rules', () => {
    it('should allow validate() with PASSED status', () => {
      const order = ClinicalOrder.create(createValidOrderData());
      expect(() => order.validate('PASSED', 0)).not.toThrow();
    });

    it('should allow validate() with WARNED status', () => {
      const order = ClinicalOrder.create(createValidOrderData());
      expect(() => order.validate('WARNED', 2)).not.toThrow();
      expect(order.cdsCheckStatus).toBe('WARNED');
    });

    it('should reject validate() if CDS status is BLOCKED', () => {
      const order = ClinicalOrder.create(createValidOrderData());
      expect(() => order.validate('BLOCKED', 1)).toThrow(CdsCheckBlockedError);
    });

    it('should require at least 1 blocking alert for reject()', () => {
      const order = ClinicalOrder.create(createValidOrderData());
      expect(() => order.reject('BLOCKED', 0)).toThrow('at least 1 blocking alert');
    });

    it('should identify MEDICATION orders requiring CDS check', () => {
      const order = ClinicalOrder.create(createValidOrderData());
      expect(order.requiresCdsCheck()).toBe(true);
      expect(order.isMedicationOrder()).toBe(true);
    });

    it('should identify non-MEDICATION orders NOT requiring CDS check', () => {
      const data = { ...createValidOrderData(), orderType: 'LAB' as OrderType };
      const order = ClinicalOrder.create(data);
      expect(order.requiresCdsCheck()).toBe(false);
      expect(order.isMedicationOrder()).toBe(false);
    });
  });

  // ==========================================================================
  // Business Logic Guards
  // ==========================================================================

  describe('Business Logic Guards', () => {
    it('canApprove() should return true for VALIDATED orders', () => {
      const order = ClinicalOrder.create(createValidOrderData());
      order.validate('PASSED', 0);
      expect(order.canApprove()).toBe(true);
    });

    it('canApprove() should return false for non-VALIDATED orders', () => {
      const order = ClinicalOrder.create(createValidOrderData());
      expect(order.canApprove()).toBe(false);
    });

    it('canDiscontinue() should return true for APPROVED orders', () => {
      const order = ClinicalOrder.create(createValidOrderData());
      order.validate('PASSED', 0);
      order.approve('doctor-uuid');
      expect(order.canDiscontinue()).toBe(true);
    });

    it('canDiscontinue() should return true for ACTIVE orders', () => {
      const order = ClinicalOrder.create(createValidOrderData());
      order.validate('PASSED', 0);
      order.approve('doctor-uuid');
      order.activate();
      expect(order.canDiscontinue()).toBe(true);
    });

    it('canDiscontinue() should return false for terminal states', () => {
      const order = ClinicalOrder.create(createValidOrderData());
      order.validate('PASSED', 0);
      order.approve('doctor-uuid');
      order.activate();
      order.complete();
      expect(order.canDiscontinue()).toBe(false);
    });
  });

  // ==========================================================================
  // Discontinuation Rules
  // ==========================================================================

  describe('Discontinuation Rules', () => {
    it('should require discontinueReason', () => {
      const order = ClinicalOrder.create(createValidOrderData());
      order.validate('PASSED', 0);
      order.approve('doctor-uuid');

      expect(() => order.discontinue('doctor-uuid', '')).toThrow(MissingRequiredFieldError);
      expect(() => order.discontinue('doctor-uuid', '')).toThrow('discontinueReason');
    });

    it('should reject empty/whitespace reason', () => {
      const order = ClinicalOrder.create(createValidOrderData());
      order.validate('PASSED', 0);
      order.approve('doctor-uuid');

      expect(() => order.discontinue('doctor-uuid', '   ')).toThrow(MissingRequiredFieldError);
    });

    it('should capture discontinuation audit fields', () => {
      const order = ClinicalOrder.create(createValidOrderData());
      order.validate('PASSED', 0);
      order.approve('doctor-uuid');

      const beforeDiscontinue = new Date();
      order.discontinue('doctor-123', 'Patient deceased');
      const afterDiscontinue = new Date();

      expect(order.discontinuedBy).toBe('doctor-123');
      expect(order.discontinueReason).toBe('Patient deceased');
      expect(order.discontinuedAt).toBeDefined();
      expect(order.discontinuedAt!.getTime()).toBeGreaterThanOrEqual(beforeDiscontinue.getTime());
      expect(order.discontinuedAt!.getTime()).toBeLessThanOrEqual(afterDiscontinue.getTime());
    });
  });

  // ==========================================================================
  // Version Management
  // ==========================================================================

  describe('Version Management', () => {
    it('should increment version on each state transition', () => {
      const order = ClinicalOrder.create(createValidOrderData());
      expect(order.version).toBe(1);

      order.validate('PASSED', 0);
      expect(order.version).toBe(2);

      order.approve('doctor-uuid');
      expect(order.version).toBe(3);

      order.activate();
      expect(order.version).toBe(4);

      order.complete();
      expect(order.version).toBe(5);
    });

    it('should update updatedAt timestamp on version increment', () => {
      const order = ClinicalOrder.create(createValidOrderData());
      const originalUpdatedAt = order.updatedAt;

      // Wait 1ms to ensure timestamp difference
      const delay = () => new Promise(resolve => setTimeout(resolve, 1));
      
      delay().then(() => {
        order.validate('PASSED', 0);
        expect(order.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
      });
    });
  });

  // ==========================================================================
  // Immutability & Serialization
  // ==========================================================================

  describe('Immutability & Serialization', () => {
    it('should return immutable Date copies from getters', () => {
      const order = ClinicalOrder.create(createValidOrderData());
      const createdAt1 = order.createdAt;
      const createdAt2 = order.createdAt;

      expect(createdAt1).not.toBe(createdAt2); // Different instances
      expect(createdAt1.getTime()).toBe(createdAt2.getTime()); // Same value
    });

    it('should serialize to plain object', () => {
      const order = ClinicalOrder.create(createValidOrderData());
      const plain = order.toPlainObject();

      expect(plain.id).toBe(order.id);
      expect(plain.tenantId).toBe(order.tenantId);
      expect(plain.encounterId).toBe(order.encounterId);
      expect(plain.orderStatus).toBe('PENDING');
      expect(plain.version).toBe(1);
      expect(plain.createdAt).toBeInstanceOf(Date);
    });

    it('should reconstitute from persistence', () => {
      const order = ClinicalOrder.create(createValidOrderData());
      order.validate('PASSED', 0);
      order.approve('doctor-uuid');

      const plain = order.toPlainObject();
      const reconstituted = ClinicalOrder.fromPersistence(plain);

      expect(reconstituted.id).toBe(order.id);
      expect(reconstituted.orderStatus).toBe('APPROVED');
      expect(reconstituted.approvedBy).toBe('doctor-uuid');
      expect(reconstituted.version).toBe(3);
    });
  });

  // ==========================================================================
  // Tenant Isolation Metadata
  // ==========================================================================

  describe('Tenant Isolation Metadata', () => {
    it('should preserve tenantId immutably', () => {
      const order = ClinicalOrder.create(createValidOrderData());
      const tenantId1 = order.tenantId;
      
      order.validate('PASSED', 0);
      order.approve('doctor-uuid');
      
      expect(order.tenantId).toBe(tenantId1);
    });

    it('should preserve encounterId immutably', () => {
      const order = ClinicalOrder.create(createValidOrderData());
      const encounterId1 = order.encounterId;
      
      order.validate('PASSED', 0);
      order.approve('doctor-uuid');
      
      expect(order.encounterId).toBe(encounterId1);
    });

    it('should preserve patientId immutably', () => {
      const order = ClinicalOrder.create(createValidOrderData());
      const patientId1 = order.patientId;
      
      order.validate('PASSED', 0);
      order.approve('doctor-uuid');
      
      expect(order.patientId).toBe(patientId1);
    });
  });
});
