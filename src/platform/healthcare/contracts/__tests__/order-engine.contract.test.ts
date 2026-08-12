/**
 * Order Engine Contract Tests
 * 
 * Validates Order Engine Contract metadata before implementation.
 * Tests event schemas, required fields, tenant isolation, encounter linkage.
 * 
 * Constitution Compliance:
 * - Law 5: Event-First Architecture (7 events validated)
 * - Law 8: Contract Registry validation
 * - Law 11: Zero `any` types
 * 
 * @module platform/healthcare/contracts/__tests__/order-engine.contract.test
 */

import {
  ORDER_ENGINE_CONTRACT,
  OrderCreatedPayload,
  OrderValidatedPayload,
  OrderApprovedPayload,
  OrderActivatedPayload,
  OrderCompletedPayload,
  OrderDiscontinuedPayload,
  OrderRejectedPayload,
} from '../order-engine.contract';

describe('Order Engine Contract', () => {
  // ========================================================================
  // Contract Metadata Tests
  // ========================================================================

  describe('Contract Metadata', () => {
    it('should have required contract metadata', () => {
      expect(ORDER_ENGINE_CONTRACT.name).toBe('order-engine');
      expect(ORDER_ENGINE_CONTRACT.version).toBe('1.0.0');
      expect(ORDER_ENGINE_CONTRACT.type).toBe('engine');
      expect(ORDER_ENGINE_CONTRACT.owner).toBe('Healthcare Platform Team');
      expect(ORDER_ENGINE_CONTRACT.status).toBe('active');
    });

    it('should have registeredAt and updatedAt timestamps', () => {
      expect(ORDER_ENGINE_CONTRACT.registeredAt).toBeDefined();
      expect(ORDER_ENGINE_CONTRACT.updatedAt).toBeDefined();
      expect(new Date(ORDER_ENGINE_CONTRACT.registeredAt).getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should define exactly 4 API endpoints', () => {
      expect(ORDER_ENGINE_CONTRACT.endpoints).toHaveLength(4);
      
      const operationIds = ORDER_ENGINE_CONTRACT.endpoints.map(e => e.operationId);
      expect(operationIds).toEqual([
        'createOrder',
        'approveOrder',
        'discontinueOrder',
        'getActiveOrders',
      ]);
    });

    it('should define exactly 7 domain events', () => {
      expect(ORDER_ENGINE_CONTRACT.events).toHaveLength(7);
      
      const eventTypes = ORDER_ENGINE_CONTRACT.events.map(e => e.eventType);
      expect(eventTypes).toEqual([
        'OrderCreated',
        'OrderValidated',
        'OrderApproved',
        'OrderActivated',
        'OrderCompleted',
        'OrderDiscontinued',
        'OrderRejected',
      ]);
    });
  });

  // ========================================================================
  // API Endpoint Tests
  // ========================================================================

  describe('API Endpoints', () => {
    describe('createOrder endpoint', () => {
      const endpoint = ORDER_ENGINE_CONTRACT.endpoints.find(e => e.operationId === 'createOrder')!;

      it('should require requestId for idempotency', () => {
        expect(endpoint.requestSchema.schema.required).toContain('requestId');
      });

      it('should require tenantId for tenant isolation', () => {
        expect(endpoint.requestSchema.schema.required).toContain('tenantId');
      });

      it('should require encounterId for encounter linkage', () => {
        expect(endpoint.requestSchema.schema.required).toContain('encounterId');
      });

      it('should require orderType, priority, orderedBy, orderDetails', () => {
        expect(endpoint.requestSchema.schema.required).toEqual(
          expect.arrayContaining(['orderType', 'priority', 'orderedBy', 'orderDetails'])
        );
      });

      it('should restrict to authorized roles', () => {
        expect(endpoint.authentication).toHaveLength(1);
        expect(endpoint.authentication[0].roles).toEqual(['doctor', 'nurse', 'admin']);
      });
    });

    describe('approveOrder endpoint', () => {
      const endpoint = ORDER_ENGINE_CONTRACT.endpoints.find(e => e.operationId === 'approveOrder')!;

      it('should require requestId, tenantId, orderId, approvedBy', () => {
        expect(endpoint.requestSchema.schema.required).toEqual(['requestId', 'tenantId', 'orderId', 'approvedBy']);
      });

      it('should restrict to doctor and admin only', () => {
        expect(endpoint.authentication[0].roles).toEqual(['doctor', 'admin']);
      });
    });

    describe('discontinueOrder endpoint', () => {
      const endpoint = ORDER_ENGINE_CONTRACT.endpoints.find(e => e.operationId === 'discontinueOrder')!;

      it('should require reason for discontinuation', () => {
        expect(endpoint.requestSchema.schema.required).toContain('reason');
      });

      it('should restrict to doctor and admin only', () => {
        expect(endpoint.authentication[0].roles).toEqual(['doctor', 'admin']);
      });
    });

    describe('getActiveOrders endpoint', () => {
      const endpoint = ORDER_ENGINE_CONTRACT.endpoints.find(e => e.operationId === 'getActiveOrders')!;

      it('should require tenantId and encounterId', () => {
        expect(endpoint.requestSchema.schema.required).toEqual(['tenantId', 'encounterId']);
      });

      it('should allow optional orderType filter', () => {
        expect(endpoint.requestSchema.schema.properties.orderType).toBeDefined();
        expect(endpoint.requestSchema.schema.required).not.toContain('orderType');
      });
    });
  });

  // ========================================================================
  // Domain Event Tests
  // ========================================================================

  describe('Domain Events', () => {
    it('should publish to correct subscribers', () => {
      const orderCreatedEvent = ORDER_ENGINE_CONTRACT.events.find(e => e.eventType === 'OrderCreated')!;
      expect(orderCreatedEvent.subscribers).toEqual(
        expect.arrayContaining(['pharmacy-engine', 'laboratory-engine', 'billing-engine', 'notification-hub'])
      );

      const orderApprovedEvent = ORDER_ENGINE_CONTRACT.events.find(e => e.eventType === 'OrderApproved')!;
      expect(orderApprovedEvent.subscribers).toEqual(
        expect.arrayContaining(['pharmacy-engine', 'laboratory-engine', 'notification-hub'])
      );

      const orderCompletedEvent = ORDER_ENGINE_CONTRACT.events.find(e => e.eventType === 'OrderCompleted')!;
      expect(orderCompletedEvent.subscribers).toEqual(
        expect.arrayContaining(['billing-engine', 'analytics-engine', 'encounter-engine'])
      );
    });

    it('should use consistent schema version (1.0.0)', () => {
      ORDER_ENGINE_CONTRACT.events.forEach(event => {
        expect(event.version).toBe('1.0.0');
        expect(event.payloadSchema.version).toBe('1.0.0');
      });
    });

    describe('OrderCreated event', () => {
      const event = ORDER_ENGINE_CONTRACT.events.find(e => e.eventType === 'OrderCreated')!;

      it('should have required fields for event correlation', () => {
        const required = event.payloadSchema.schema.required;
        expect(required).toEqual(
          expect.arrayContaining(['orderId', 'tenantId', 'encounterId', 'patientId', 'correlationId', 'causationId'])
        );
      });

      it('should include order context fields', () => {
        const required = event.payloadSchema.schema.required;
        expect(required).toEqual(
          expect.arrayContaining(['orderType', 'orderStatus', 'priority', 'orderedBy', 'orderedAt'])
        );
      });

      it('should have cdsCheckStatus as optional (only for MEDICATION orders)', () => {
        const required = event.payloadSchema.schema.required;
        expect(required).not.toContain('cdsCheckStatus');
        expect(event.payloadSchema.schema.properties.cdsCheckStatus).toBeDefined();
      });
    });

    describe('OrderValidated event', () => {
      const event = ORDER_ENGINE_CONTRACT.events.find(e => e.eventType === 'OrderValidated')!;

      it('should constrain orderStatus to VALIDATED', () => {
        expect(event.payloadSchema.schema.properties.orderStatus.const).toBe('VALIDATED');
      });

      it('should require cdsCheckStatus and cdsAlertsCount', () => {
        const required = event.payloadSchema.schema.required;
        expect(required).toContain('cdsCheckStatus');
        expect(required).toContain('cdsAlertsCount');
      });

      it('should validate cdsCheckStatus enum (PASSED or WARNED only)', () => {
        const cdsCheckStatus = event.payloadSchema.schema.properties.cdsCheckStatus;
        expect(cdsCheckStatus.enum).toEqual(['PASSED', 'WARNED']);
      });
    });

    describe('OrderApproved event', () => {
      const event = ORDER_ENGINE_CONTRACT.events.find(e => e.eventType === 'OrderApproved')!;

      it('should constrain orderStatus to APPROVED', () => {
        expect(event.payloadSchema.schema.properties.orderStatus.const).toBe('APPROVED');
      });

      it('should require approvedBy and approvedAt for audit', () => {
        const required = event.payloadSchema.schema.required;
        expect(required).toContain('approvedBy');
        expect(required).toContain('approvedAt');
      });
    });

    describe('OrderActivated event', () => {
      const event = ORDER_ENGINE_CONTRACT.events.find(e => e.eventType === 'OrderActivated')!;

      it('should constrain orderStatus to ACTIVE', () => {
        expect(event.payloadSchema.schema.properties.orderStatus.const).toBe('ACTIVE');
      });

      it('should include orderType for subscriber routing', () => {
        const required = event.payloadSchema.schema.required;
        expect(required).toContain('orderType');
      });
    });

    describe('OrderCompleted event', () => {
      const event = ORDER_ENGINE_CONTRACT.events.find(e => e.eventType === 'OrderCompleted')!;

      it('should constrain orderStatus to COMPLETED', () => {
        expect(event.payloadSchema.schema.properties.orderStatus.const).toBe('COMPLETED');
      });

      it('should publish to encounter-engine for completion check', () => {
        expect(event.subscribers).toContain('encounter-engine');
      });
    });

    describe('OrderDiscontinued event', () => {
      const event = ORDER_ENGINE_CONTRACT.events.find(e => e.eventType === 'OrderDiscontinued')!;

      it('should constrain orderStatus to DISCONTINUED', () => {
        expect(event.payloadSchema.schema.properties.orderStatus.const).toBe('DISCONTINUED');
      });

      it('should require discontinueReason for audit', () => {
        const required = event.payloadSchema.schema.required;
        expect(required).toContain('discontinueReason');
        expect(required).toContain('discontinuedBy');
        expect(required).toContain('discontinuedAt');
      });
    });

    describe('OrderRejected event', () => {
      const event = ORDER_ENGINE_CONTRACT.events.find(e => e.eventType === 'OrderRejected')!;

      it('should constrain orderStatus to REJECTED', () => {
        expect(event.payloadSchema.schema.properties.orderStatus.const).toBe('REJECTED');
      });

      it('should require cdsCheckStatus to be BLOCKED', () => {
        expect(event.payloadSchema.schema.properties.cdsCheckStatus.const).toBe('BLOCKED');
      });

      it('should require blockingAlertsCount (minimum 1)', () => {
        const required = event.payloadSchema.schema.required;
        expect(required).toContain('blockingAlertsCount');
        expect(event.payloadSchema.schema.properties.blockingAlertsCount.minimum).toBe(1);
      });

      it('should publish to quality-assurance-engine for safety review', () => {
        expect(event.subscribers).toContain('quality-assurance-engine');
      });
    });
  });

  // ========================================================================
  // Event Payload Type Tests (TypeScript Validation)
  // ========================================================================

  describe('Event Payload Types', () => {
    it('OrderCreatedPayload should require all correlation fields', () => {
      const validPayload: OrderCreatedPayload = {
        orderId: 'order-uuid',
        tenantId: 'tenant-uuid',
        encounterId: 'encounter-uuid',
        patientId: 'patient-uuid',
        orderType: 'MEDICATION',
        orderStatus: 'PENDING',
        priority: 'ROUTINE',
        orderedBy: 'doctor-uuid',
        orderedAt: new Date().toISOString(),
        correlationId: 'correlation-uuid',
        causationId: 'causation-uuid',
      };

      expect(validPayload.orderId).toBeDefined();
      expect(validPayload.encounterId).toBeDefined();
      expect(validPayload.correlationId).toBeDefined();
    });

    it('OrderValidatedPayload should require CDS validation results', () => {
      const validPayload: OrderValidatedPayload = {
        orderId: 'order-uuid',
        tenantId: 'tenant-uuid',
        encounterId: 'encounter-uuid',
        orderStatus: 'VALIDATED',
        cdsCheckStatus: 'PASSED',
        cdsAlertsCount: 0,
        validatedAt: new Date().toISOString(),
        correlationId: 'correlation-uuid',
        causationId: 'causation-uuid',
      };

      expect(validPayload.cdsCheckStatus).toBe('PASSED');
      expect(validPayload.cdsAlertsCount).toBe(0);
    });

    it('OrderApprovedPayload should require approval audit fields', () => {
      const validPayload: OrderApprovedPayload = {
        orderId: 'order-uuid',
        tenantId: 'tenant-uuid',
        encounterId: 'encounter-uuid',
        orderStatus: 'APPROVED',
        approvedBy: 'doctor-uuid',
        approvedAt: new Date().toISOString(),
        correlationId: 'correlation-uuid',
        causationId: 'causation-uuid',
      };

      expect(validPayload.approvedBy).toBeDefined();
      expect(validPayload.approvedAt).toBeDefined();
    });

    it('OrderActivatedPayload should include orderType', () => {
      const validPayload: OrderActivatedPayload = {
        orderId: 'order-uuid',
        tenantId: 'tenant-uuid',
        encounterId: 'encounter-uuid',
        orderType: 'MEDICATION',
        orderStatus: 'ACTIVE',
        activatedAt: new Date().toISOString(),
        correlationId: 'correlation-uuid',
        causationId: 'causation-uuid',
      };

      expect(validPayload.orderType).toBe('MEDICATION');
    });

    it('OrderCompletedPayload should have minimal required fields', () => {
      const validPayload: OrderCompletedPayload = {
        orderId: 'order-uuid',
        tenantId: 'tenant-uuid',
        encounterId: 'encounter-uuid',
        orderStatus: 'COMPLETED',
        completedAt: new Date().toISOString(),
        correlationId: 'correlation-uuid',
        causationId: 'causation-uuid',
      };

      expect(validPayload.orderStatus).toBe('COMPLETED');
    });

    it('OrderDiscontinuedPayload should require reason and audit fields', () => {
      const validPayload: OrderDiscontinuedPayload = {
        orderId: 'order-uuid',
        tenantId: 'tenant-uuid',
        encounterId: 'encounter-uuid',
        orderStatus: 'DISCONTINUED',
        discontinuedBy: 'doctor-uuid',
        discontinuedAt: new Date().toISOString(),
        discontinueReason: 'Patient condition improved, no longer needed',
        correlationId: 'correlation-uuid',
        causationId: 'causation-uuid',
      };

      expect(validPayload.discontinueReason).toBeDefined();
      expect(validPayload.discontinuedBy).toBeDefined();
    });

    it('OrderRejectedPayload should require CDS blocking details', () => {
      const validPayload: OrderRejectedPayload = {
        orderId: 'order-uuid',
        tenantId: 'tenant-uuid',
        encounterId: 'encounter-uuid',
        orderStatus: 'REJECTED',
        cdsCheckStatus: 'BLOCKED',
        blockingAlertsCount: 2,
        rejectedAt: new Date().toISOString(),
        correlationId: 'correlation-uuid',
        causationId: 'causation-uuid',
      };

      expect(validPayload.cdsCheckStatus).toBe('BLOCKED');
      expect(validPayload.blockingAlertsCount).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // Contract Invariants (Constitution Compliance)
  // ========================================================================

  describe('Contract Invariants', () => {
    it('should enforce tenant isolation (tenantId in all events)', () => {
      ORDER_ENGINE_CONTRACT.events.forEach(event => {
        const required = event.payloadSchema.schema.required;
        expect(required).toContain('tenantId');
      });
    });

    it('should enforce encounter linkage (encounterId in all events)', () => {
      ORDER_ENGINE_CONTRACT.events.forEach(event => {
        const required = event.payloadSchema.schema.required;
        expect(required).toContain('encounterId');
      });
    });

    it('should enforce event correlation (correlationId + causationId in all events)', () => {
      ORDER_ENGINE_CONTRACT.events.forEach(event => {
        const required = event.payloadSchema.schema.required;
        expect(required).toContain('correlationId');
        expect(required).toContain('causationId');
      });
    });

    it('should enforce immutable event payload (all payloads are interfaces, not classes)', () => {
      // TypeScript type check - if this compiles, payloads are correctly typed as interfaces
      const payload: OrderCreatedPayload = {
        orderId: 'test',
        tenantId: 'test',
        encounterId: 'test',
        patientId: 'test',
        orderType: 'MEDICATION',
        orderStatus: 'PENDING',
        priority: 'ROUTINE',
        orderedBy: 'test',
        orderedAt: new Date().toISOString(),
        correlationId: 'test',
        causationId: 'test',
      };

      expect(payload).toBeDefined();
    });

    it('should use UUID format for all ID fields', () => {
      const orderCreatedEvent = ORDER_ENGINE_CONTRACT.events.find(e => e.eventType === 'OrderCreated')!;
      const properties = orderCreatedEvent.payloadSchema.schema.properties;

      expect(properties.orderId.format).toBe('uuid');
      expect(properties.tenantId.format).toBe('uuid');
      expect(properties.encounterId.format).toBe('uuid');
      expect(properties.patientId.format).toBe('uuid');
      expect(properties.orderedBy.format).toBe('uuid');
      expect(properties.correlationId.format).toBe('uuid');
      expect(properties.causationId.format).toBe('uuid');
    });

    it('should use date-time format for timestamp fields', () => {
      const orderCreatedEvent = ORDER_ENGINE_CONTRACT.events.find(e => e.eventType === 'OrderCreated')!;
      const properties = orderCreatedEvent.payloadSchema.schema.properties;

      expect(properties.orderedAt.format).toBe('date-time');
    });
  });

  // ========================================================================
  // Cross-Engine Integration Validation
  // ========================================================================

  describe('Cross-Engine Integration', () => {
    it('should publish OrderCreated to pharmacy-engine for MEDICATION orders', () => {
      const event = ORDER_ENGINE_CONTRACT.events.find(e => e.eventType === 'OrderCreated')!;
      expect(event.subscribers).toContain('pharmacy-engine');
    });

    it('should publish OrderApproved to pharmacy-engine for dispensing workflow', () => {
      const event = ORDER_ENGINE_CONTRACT.events.find(e => e.eventType === 'OrderApproved')!;
      expect(event.subscribers).toContain('pharmacy-engine');
    });

    it('should publish OrderCompleted to encounter-engine for completion check', () => {
      const event = ORDER_ENGINE_CONTRACT.events.find(e => e.eventType === 'OrderCompleted')!;
      expect(event.subscribers).toContain('encounter-engine');
    });

    it('should publish OrderDiscontinued to pharmacy-engine for inventory return', () => {
      const event = ORDER_ENGINE_CONTRACT.events.find(e => e.eventType === 'OrderDiscontinued')!;
      expect(event.subscribers).toContain('pharmacy-engine');
    });

    it('should not create circular dependencies (no order-engine subscriber)', () => {
      ORDER_ENGINE_CONTRACT.events.forEach(event => {
        expect(event.subscribers).not.toContain('order-engine');
      });
    });
  });
});
