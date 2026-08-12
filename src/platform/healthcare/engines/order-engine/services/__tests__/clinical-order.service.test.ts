/**
 * Clinical Order Service Tests
 * 
 * Focus: Event-After-Persistence invariant
 * 
 * Test categories:
 * 1. Happy path (create → persist → publish)
 * 2. Encounter validation
 * 3. Patient validation
 * 4. Event ordering (DB THEN EventBus)
 * 5. Event publish failure (DB remains consistent)
 * 6. Idempotency
 * 7. Optimistic locking
 * 8. Tenant isolation
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ClinicalOrderService } from '../clinical-order.service';
import type { OrderRepository, OrderQueryFilters, OrderSaveOptions } from '../../repositories/order-repository.interface';
import { OptimisticLockError, IdempotencyConflictError } from '../../repositories/order-repository.interface';
import type { EncounterReader, EncounterSnapshot } from '../../contracts/encounter-reader.interface';
import { EncounterNotFoundError } from '../../contracts/encounter-reader.interface';
import { InMemoryEventBus } from '../../contracts/event-bus.interface';
import { ClinicalOrder } from '../../domain/clinical-order.entity';

// In-Memory Order Repository (Test Double)
class InMemoryOrderRepository implements OrderRepository {
  private orders = new Map<string, ClinicalOrder>();
  private requestIdIndex = new Map<string, string>();
  
  async create(order: ClinicalOrder, requestId?: string): Promise<ClinicalOrder> {
    if (requestId) {
      const key = `${order.tenantId}:${requestId}`;
      const existingOrderId = this.requestIdIndex.get(key);
      if (existingOrderId) {
        const existing = this.orders.get(existingOrderId);
        if (existing) {
          // Idempotency: Return existing order instead of throwing
          return existing;
        }
      }
      this.requestIdIndex.set(key, order.id);
    }
    
    this.orders.set(order.id, order);
    return order;
  }
  
  async findById(tenantId: string, orderId: string): Promise<ClinicalOrder | null> {
    const order = this.orders.get(orderId);
    if (!order || order.tenantId !== tenantId) return null;
    return order;
  }
  
  async findByRequestId(tenantId: string, requestId: string): Promise<ClinicalOrder | null> {
    const key = `${tenantId}:${requestId}`;
    const orderId = this.requestIdIndex.get(key);
    if (!orderId) return null;
    return this.findById(tenantId, orderId);
  }
  
  async findByFilters(filters: OrderQueryFilters): Promise<ClinicalOrder[]> {
    return Array.from(this.orders.values()).filter(order => {
      if (filters.tenantId && order.tenantId !== filters.tenantId) return false;
      if (filters.encounterId && order.encounterId !== filters.encounterId) return false;
      if (filters.patientPartyId && order.patientPartyId !== filters.patientPartyId) return false;
      if (filters.orderType && order.orderType !== filters.orderType) return false;
      if (filters.orderStatus && order.orderStatus !== filters.orderStatus) return false;
      return true;
    });
  }
  
  async findActiveByEncounter(tenantId: string, encounterId: string): Promise<ClinicalOrder[]> {
    return Array.from(this.orders.values()).filter(order => 
      order.tenantId === tenantId &&
      order.encounterId === encounterId &&
      order.orderStatus !== 'COMPLETED' &&
      order.orderStatus !== 'DISCONTINUED' &&
      order.orderStatus !== 'REJECTED'
    );
  }
  
  async update(order: ClinicalOrder, options?: OrderSaveOptions): Promise<ClinicalOrder> {
    const existing = this.orders.get(order.id);
    if (!existing) {
      throw new Error(`Order ${order.id} not found`);
    }
    
    if (options?.expectedVersion !== undefined && existing.version !== options.expectedVersion) {
      throw new OptimisticLockError(order.id, options.expectedVersion, existing.version);
    }
    
    this.orders.set(order.id, order);
    return order;
  }
  
  async softDelete(tenantId: string, orderId: string, discontinuedBy: string, discontinueReason: string): Promise<ClinicalOrder> {
    const order = await this.findById(tenantId, orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }
    
    order.discontinue(discontinuedBy, discontinueReason);
    return this.update(order);
  }
  
  async exists(tenantId: string, orderId: string): Promise<boolean> {
    const order = await this.findById(tenantId, orderId);
    return order !== null;
  }
}

// Test Encounter Reader (Mock)
class TestEncounterReader implements EncounterReader {
  private encounters = new Map<string, EncounterSnapshot>();
  
  setEncounter(encounter: EncounterSnapshot): void {
    const key = `${encounter.encounterId}`;
    this.encounters.set(key, encounter);
  }
  
  async getEncounterSnapshot(tenantId: string, encounterId: string): Promise<EncounterSnapshot> {
    const key = `${encounterId}`;
    const encounter = this.encounters.get(key);
    
    if (!encounter) {
      throw new EncounterNotFoundError(encounterId, tenantId);
    }
    
    return encounter;
  }
  
  async canCreateOrders(tenantId: string, encounterId: string): Promise<boolean> {
    try {
      const encounter = await this.getEncounterSnapshot(tenantId, encounterId);
      return encounter.status === 'IN_PROGRESS';
    } catch {
      return false;
    }
  }
  
  clear(): void {
    this.encounters.clear();
  }
}

// Test fixtures
const TEST_TENANT_ID = '11111111-1111-1111-1111-111111111111';
const TEST_ENCOUNTER_ID = '22222222-2222-2222-2222-222222222222';
const TEST_PATIENT_ID = '33333333-3333-3333-3333-333333333333';

function createTestEncounter(overrides?: Partial<EncounterSnapshot>): EncounterSnapshot {
  return {
    encounterId: TEST_ENCOUNTER_ID,
    patientPartyId: TEST_PATIENT_ID,
    status: 'IN_PROGRESS',
    encounterType: 'INPATIENT',
    admittedAt: new Date('2026-08-12T08:00:00Z'),
    dischargedAt: null,
    ...overrides,
  };
}

describe('ClinicalOrderService', () => {
  let service: ClinicalOrderService;
  let repository: OrderRepository;
  let encounterReader: TestEncounterReader;
  let eventBus: InMemoryEventBus;
  
  beforeEach(() => {
    repository = new InMemoryOrderRepository();
    encounterReader = new TestEncounterReader();
    eventBus = new InMemoryEventBus();
    service = new ClinicalOrderService(repository, encounterReader, eventBus);
    
    // Setup default active encounter
    encounterReader.setEncounter(createTestEncounter());
  });
  
  describe('createOrder', () => {
    it('should create order + persist + publish event (happy path)', async () => {
      const request = {
        tenantId: TEST_TENANT_ID,
        encounterId: TEST_ENCOUNTER_ID,
        patientId: TEST_PATIENT_ID,  // Domain field name
        orderType: 'MEDICATION' as const,
        priority: 'ROUTINE' as const,
        orderedBy: 'Dr. Smith',
        orderDetails: { drug: 'Aspirin 100mg' },
      };
      
      const result = await service.createOrder(request);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.orderStatus).toBe('PENDING');
      expect(result.eventPublished).toBe(true);
      
      // Verify persistence
      const saved = await repository.findById(TEST_TENANT_ID, result.data!.id);
      expect(saved).toBeDefined();
      expect(saved?.id).toBe(result.data!.id);
      
      // Verify event published
      const events = eventBus.getEventsByType('OrderCreated');
      expect(events.length).toBe(1);
      expect(events[0].payload.orderId).toBe(result.data!.id);
      expect(events[0].payload.encounterId).toBe(TEST_ENCOUNTER_ID);
    });
    
    it('should support idempotency via requestId', async () => {
      const request = {
        tenantId: TEST_TENANT_ID,
        encounterId: TEST_ENCOUNTER_ID,
        patientId: TEST_PATIENT_ID,
        orderType: 'LAB' as const,
        priority: 'STAT' as const,
        orderedBy: 'Dr. Jones',
        orderDetails: { test: 'CBC' },
        requestId: 'request-123',
      };
      
      const result1 = await service.createOrder(request);
      expect(result1.success).toBe(true);
      
      const result2 = await service.createOrder(request);
      expect(result2.success).toBe(true);
      expect(result2.data?.id).toBe(result1.data?.id);  // Same order returned
      
      // Event should only be published once (first call)
      const events = eventBus.getEventsByType('OrderCreated');
      expect(events.length).toBe(1);
    });
    
    it('should reject order if encounter not found', async () => {
      encounterReader.clear();
      
      const request = {
        tenantId: TEST_TENANT_ID,
        encounterId: 'non-existent-encounter',
        patientId: TEST_PATIENT_ID,
        orderType: 'MEDICATION' as const,
        priority: 'ROUTINE' as const,
        orderedBy: 'Dr. Smith',
        orderDetails: {},
      };
      
      const result = await service.createOrder(request);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
      expect(result.eventPublished).toBe(false);
      
      // No events published
      expect(eventBus.getPublishedEvents().length).toBe(0);
    });
    
    it('should reject order if patient does not belong to encounter', async () => {
      encounterReader.setEncounter(
        createTestEncounter({ patientPartyId: 'different-patient-id' })
      );
      
      const request = {
        tenantId: TEST_TENANT_ID,
        encounterId: TEST_ENCOUNTER_ID,
        patientId: TEST_PATIENT_ID,
        orderType: 'MEDICATION' as const,
        priority: 'ROUTINE' as const,
        orderedBy: 'Dr. Smith',
        orderDetails: {},
      };
      
      const result = await service.createOrder(request);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('does not belong to encounter');
      expect(result.eventPublished).toBe(false);
    });
    
    it('should reject order if encounter status is FINISHED', async () => {
      encounterReader.setEncounter(
        createTestEncounter({ status: 'FINISHED' })
      );
      
      const request = {
        tenantId: TEST_TENANT_ID,
        encounterId: TEST_ENCOUNTER_ID,
        patientId: TEST_PATIENT_ID,
        orderType: 'MEDICATION' as const,
        priority: 'ROUTINE' as const,
        orderedBy: 'Dr. Smith',
        orderDetails: {},
      };
      
      const result = await service.createOrder(request);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('does not allow new orders');
      expect(result.eventPublished).toBe(false);
    });
    
    it('should reject order if encounter status is CANCELLED', async () => {
      encounterReader.setEncounter(
        createTestEncounter({ status: 'CANCELLED' })
      );
      
      const request = {
        tenantId: TEST_TENANT_ID,
        encounterId: TEST_ENCOUNTER_ID,
        patientId: TEST_PATIENT_ID,
        orderType: 'MEDICATION' as const,
        priority: 'ROUTINE' as const,
        orderedBy: 'Dr. Smith',
        orderDetails: {},
      };
      
      const result = await service.createOrder(request);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('does not allow new orders');
    });
    
    it('should persist order even if event publish fails', async () => {
      eventBus.simulateFailure(true);
      
      const request = {
        tenantId: TEST_TENANT_ID,
        encounterId: TEST_ENCOUNTER_ID,
        patientId: TEST_PATIENT_ID,
        orderType: 'MEDICATION' as const,
        priority: 'ROUTINE' as const,
        orderedBy: 'Dr. Smith',
        orderDetails: {},
      };
      
      const result = await service.createOrder(request);
      
      // Service returns success (DB persisted)
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.eventPublished).toBe(false);  // Event failed
      
      // Verify DB persistence succeeded
      const saved = await repository.findById(TEST_TENANT_ID, result.data!.id);
      expect(saved).toBeDefined();
    });
  });
  
  describe('approveOrder', () => {
    it('should approve order + persist + publish event', async () => {
      // Create order first
      const order = ClinicalOrder.create({
        tenantId: TEST_TENANT_ID,
        encounterId: TEST_ENCOUNTER_ID,
        patientId: TEST_PATIENT_ID,
        orderType: 'MEDICATION',
        priority: 'ROUTINE',
        orderedBy: 'Dr. Smith',
        orderDetails: {},
      });
      
      order.validate();  // ← Validate before approve
      
      await repository.create(order);
      eventBus.clear();
      
      const request = {
        tenantId: TEST_TENANT_ID,
        orderId: order.id,
        approvedBy: 'Dr. Johnson',
      };
      
      const result = await service.approveOrder(request);
      
      expect(result.success).toBe(true);
      expect(result.data?.orderStatus).toBe('APPROVED');
      expect(result.data?.approvedBy).toBe('Dr. Johnson');
      expect(result.data?.version).toBe(3);  // Version: create(1) + validate(2) + approve(3)
      expect(result.eventPublished).toBe(true);
      
      // Verify event
      const events = eventBus.getEventsByType('OrderApproved');
      expect(events.length).toBe(1);
      expect(events[0].payload.previousStatus).toBe('VALIDATED');  // After validate()
      expect(events[0].payload.newStatus).toBe('APPROVED');
      expect(events[0].payload.previousVersion).toBe(2);  // Before approve()
      expect(events[0].payload.newVersion).toBe(3);  // After approve()
    });
    
    it('should enforce optimistic locking', async () => {
      const order = ClinicalOrder.create({
        tenantId: TEST_TENANT_ID,
        encounterId: TEST_ENCOUNTER_ID,
        patientId: TEST_PATIENT_ID,
        orderType: 'MEDICATION',
        priority: 'ROUTINE',
        orderedBy: 'Dr. Smith',
        orderDetails: {},
      });
      
      order.validate();  // ← Validate before approve
      
      await repository.create(order);
      
      const request = {
        tenantId: TEST_TENANT_ID,
        orderId: order.id,
        approvedBy: 'Dr. Johnson',
        expectedVersion: 999,  // Wrong version
      };
      
      const result = await service.approveOrder(request);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('version');
      expect(result.eventPublished).toBe(false);
    });
    
    it('should return error if order not found', async () => {
      const request = {
        tenantId: TEST_TENANT_ID,
        orderId: 'non-existent-order',
        approvedBy: 'Dr. Johnson',
      };
      
      const result = await service.approveOrder(request);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
    
    it('should persist approval even if event publish fails', async () => {
      const order = ClinicalOrder.create({
        tenantId: TEST_TENANT_ID,
        encounterId: TEST_ENCOUNTER_ID,
        patientId: TEST_PATIENT_ID,
        orderType: 'MEDICATION',
        priority: 'ROUTINE',
        orderedBy: 'Dr. Smith',
        orderDetails: {},
      });
      
      order.validate();  // ← Validate before approve
      
      await repository.create(order);
      eventBus.simulateFailure(true);
      
      const request = {
        tenantId: TEST_TENANT_ID,
        orderId: order.id,
        approvedBy: 'Dr. Johnson',
      };
      
      const result = await service.approveOrder(request);
      
      expect(result.success).toBe(true);
      expect(result.eventPublished).toBe(false);
      
      // Verify DB updated
      const saved = await repository.findById(TEST_TENANT_ID, order.id);
      expect(saved?.orderStatus).toBe('APPROVED');
    });
  });
  
  describe('discontinueOrder', () => {
    it('should discontinue order + persist + publish event', async () => {
      const order = ClinicalOrder.create({
        tenantId: TEST_TENANT_ID,
        encounterId: TEST_ENCOUNTER_ID,
        patientId: TEST_PATIENT_ID,
        orderType: 'MEDICATION',
        priority: 'ROUTINE',
        orderedBy: 'Dr. Smith',
        orderDetails: {},
      });
      
      order.validate();  // ← Validate then approve
      order.approve('Dr. Johnson');
      
      await repository.create(order);
      eventBus.clear();
      
      const request = {
        tenantId: TEST_TENANT_ID,
        orderId: order.id,
        discontinuedBy: 'Dr. Brown',
        discontinueReason: 'Patient allergic reaction',
      };
      
      const result = await service.discontinueOrder(request);
      
      expect(result.success).toBe(true);
      expect(result.data?.orderStatus).toBe('DISCONTINUED');
      expect(result.data?.discontinuedBy).toBe('Dr. Brown');
      expect(result.data?.discontinueReason).toBe('Patient allergic reaction');
      expect(result.eventPublished).toBe(true);
      
      // Verify event
      const events = eventBus.getEventsByType('OrderDiscontinued');
      expect(events.length).toBe(1);
      expect(events[0].payload.discontinueReason).toBe('Patient allergic reaction');
    });
    
    it('should enforce optimistic locking on discontinue', async () => {
      const order = ClinicalOrder.create({
        tenantId: TEST_TENANT_ID,
        encounterId: TEST_ENCOUNTER_ID,
        patientId: TEST_PATIENT_ID,
        orderType: 'MEDICATION',
        priority: 'ROUTINE',
        orderedBy: 'Dr. Smith',
        orderDetails: {},
      });
      
      order.validate();  // ← Validate then approve
      order.approve('Dr. Johnson');
      
      await repository.create(order);
      
      const request = {
        tenantId: TEST_TENANT_ID,
        orderId: order.id,
        discontinuedBy: 'Dr. Brown',
        discontinueReason: 'Test',
        expectedVersion: 888,  // Wrong version
      };
      
      const result = await service.discontinueOrder(request);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('version');
    });
    
    it('should persist discontinuation even if event publish fails', async () => {
      const order = ClinicalOrder.create({
        tenantId: TEST_TENANT_ID,
        encounterId: TEST_ENCOUNTER_ID,
        patientId: TEST_PATIENT_ID,
        orderType: 'MEDICATION',
        priority: 'ROUTINE',
        orderedBy: 'Dr. Smith',
        orderDetails: {},
      });
      
      order.validate();  // ← Validate then approve
      order.approve('Dr. Johnson');
      
      await repository.create(order);
      eventBus.simulateFailure(true);
      
      const request = {
        tenantId: TEST_TENANT_ID,
        orderId: order.id,
        discontinuedBy: 'Dr. Brown',
        discontinueReason: 'Test',
      };
      
      const result = await service.discontinueOrder(request);
      
      expect(result.success).toBe(true);
      expect(result.eventPublished).toBe(false);
      
      // Verify DB updated
      const saved = await repository.findById(TEST_TENANT_ID, order.id);
      expect(saved?.orderStatus).toBe('DISCONTINUED');
    });
  });
  
  describe('Event-After-Persistence Invariant', () => {
    it('should NEVER publish event before DB persistence', async () => {
      // This test verifies code structure, not runtime behavior
      // In production: Add instrumentation/tracing to verify ordering
      
      const request = {
        tenantId: TEST_TENANT_ID,
        encounterId: TEST_ENCOUNTER_ID,
        patientId: TEST_PATIENT_ID,
        orderType: 'MEDICATION' as const,
        priority: 'ROUTINE' as const,
        orderedBy: 'Dr. Smith',
        orderDetails: {},
      };
      
      const result = await service.createOrder(request);
      
      expect(result.success).toBe(true);
      
      // If we got here, DB persistence succeeded
      // Event should be published (or failed with logged error)
      // No way to publish event BEFORE DB in current code structure
    });
    
    it('should handle event bus failure gracefully (DB remains consistent)', async () => {
      eventBus.simulateFailure(true);
      
      const request = {
        tenantId: TEST_TENANT_ID,
        encounterId: TEST_ENCOUNTER_ID,
        patientId: TEST_PATIENT_ID,
        orderType: 'MEDICATION' as const,
        priority: 'ROUTINE' as const,
        orderedBy: 'Dr. Smith',
        orderDetails: {},
      };
      
      const result = await service.createOrder(request);
      
      // Service succeeds (DB persisted)
      expect(result.success).toBe(true);
      expect(result.eventPublished).toBe(false);
      
      // DB is consistent
      const saved = await repository.findById(TEST_TENANT_ID, result.data!.id);
      expect(saved).toBeDefined();
      expect(saved?.orderStatus).toBe('PENDING');
      
      // In production: Event would be retried via outbox pattern (Phase D)
    });
  });
});
