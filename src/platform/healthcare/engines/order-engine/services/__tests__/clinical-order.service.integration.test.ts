/**
 * Clinical Order Service Integration Tests
 * 
 * Tests FULL workflow with REAL components:
 * - Real Supabase database
 * - Real Encounter data (via HealthcareTestFixtures)
 * - Real SupabaseOrderRepository
 * - Real Event Bus (InMemory for now)
 * 
 * Acceptance Criteria:
 * 1. createOrder: Encounter → Order → DB → OrderCreated event
 * 2. approveOrder: status APPROVED + version++ + OrderApproved
 * 3. discontinueOrder: status DISCONTINUED + reason + OrderDiscontinued
 * 4. Tenant isolation enforced
 * 5. Idempotency enforced (same requestId → same order)
 * 6. Optimistic locking enforced
 * 7. Event-After-Persistence invariant (DB THEN EventBus)
 * 8. Event failure → DB remains consistent
 * 9. Encounter validation (missing/wrong patient/finished/cancelled → reject)
 * 
 * Target: ALL tests PASS in <10 seconds
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createClient } from '@/lib/supabase-server';
import { ClinicalOrderService } from '../clinical-order.service';
import { SupabaseOrderRepository } from '../../repositories/supabase-order-repository';
import type { EncounterReader, EncounterSnapshot } from '../../contracts/encounter-reader.interface';
import { EncounterNotFoundError } from '../../contracts/encounter-reader.interface';
import { InMemoryEventBus } from '../../contracts/event-bus.interface';
import { HealthcareTestFixtures, type HealthcareTestFixture } from '@/platform/healthcare/__tests__/fixtures/healthcare-test-fixtures';
import { randomUUID } from 'crypto';
import { ClinicalOrder } from '../../domain/clinical-order.entity';

// Real Encounter Reader (queries hc_encounters table)
class SupabaseEncounterReader implements EncounterReader {
  constructor(private readonly supabase: Awaited<ReturnType<typeof createClient>>) {}
  
  async getEncounterSnapshot(tenantId: string, encounterId: string): Promise<EncounterSnapshot> {
    const { data, error } = await this.supabase
      .from('hc_encounters')
      .select('id, patient_party_id, status, encounter_class, started_at, finished_at')
      .eq('tenant_id', tenantId)
      .eq('id', encounterId)
      .single();
    
    if (error || !data) {
      throw new EncounterNotFoundError(encounterId, tenantId);
    }
    
    return {
      encounterId: data.id,
      patientPartyId: data.patient_party_id,
      status: this.mapEncounterStatus(data.status),
      encounterType: data.encounter_class || 'scheduled',
      admittedAt: data.started_at ? new Date(data.started_at) : new Date(),
      dischargedAt: data.finished_at ? new Date(data.finished_at) : null,
    };
  }
  
  async canCreateOrders(tenantId: string, encounterId: string): Promise<boolean> {
    try {
      const snapshot = await this.getEncounterSnapshot(tenantId, encounterId);
      // Only IN_PROGRESS encounters allow new orders
      return snapshot.status === 'IN_PROGRESS';
    } catch (error) {
      // Encounter not found or other errors → cannot create orders
      return false;
    }
  }
  
  private mapEncounterStatus(dbStatus: string): EncounterSnapshot['status'] {
    // Map database status to domain status
    // DB: 'planned', 'arrived', 'triaged', 'in-progress', 'on-hold', 'finished', 'cancelled'
    switch (dbStatus) {
      case 'planned':
      case 'arrived':
        return 'REGISTERED';
      case 'triaged':
      case 'in-progress':
      case 'on-hold':
        return 'IN_PROGRESS';
      case 'finished':
        return 'FINISHED';
      case 'cancelled':
        return 'CANCELLED';
      default:
        return 'REGISTERED';
    }
  }
}

describe('ClinicalOrderService Integration Tests', () => {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let service: ClinicalOrderService;
  let repository: SupabaseOrderRepository;
  let encounterReader: EncounterReader;
  let eventBus: InMemoryEventBus;
  
  let fixtures: HealthcareTestFixture;
  let createdOrderIds: string[] = [];
  
  // Separate fixtures for validation tests (to avoid state pollution)
  let finishedFixture: HealthcareTestFixture | null = null;
  let cancelledFixture: HealthcareTestFixture | null = null;
  
  beforeEach(async () => {
    // Setup test fixtures (Patient + Provider + Journey + Encounter)
    fixtures = await HealthcareTestFixtures.setup();
    
    supabase = await createClient();
    repository = new SupabaseOrderRepository(supabase);
    encounterReader = new SupabaseEncounterReader(supabase);
    eventBus = new InMemoryEventBus();
    service = new ClinicalOrderService(repository, encounterReader, eventBus);
    
    eventBus.clear();
  });
  
  afterEach(async () => {
    // Cleanup created orders
    if (createdOrderIds.length > 0) {
      await supabase
        .from('hc_clinical_orders')
        .delete()
        .in('id', createdOrderIds);
      
      createdOrderIds = [];
    }
    
    // Cleanup test fixtures
    await fixtures.cleanup();
    
    // Cleanup separate validation fixtures
    if (finishedFixture) {
      await finishedFixture.cleanup();
      finishedFixture = null;
    }
    if (cancelledFixture) {
      await cancelledFixture.cleanup();
      cancelledFixture = null;
    }
  });
  
  describe('createOrder - End-to-End', () => {
    it('should create order with real encounter + persist to DB + publish event', async () => {
      const request = {
        tenantId: fixtures.tenantId,
        encounterId: fixtures.encounterId,
        patientId: fixtures.patientPartyId,
        orderType: 'MEDICATION' as const,
        priority: 'ROUTINE' as const,
        orderedBy: fixtures.providerPartyId,
        orderDetails: { drug: 'Aspirin 100mg', dosage: '1 tablet' },
      };
      
      const result = await service.createOrder(request);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.orderType).toBe('MEDICATION');
      expect(result.data?.orderStatus).toBe('PENDING');
      expect(result.eventPublished).toBe(true);
      
      if (result.data) {
        createdOrderIds.push(result.data.id);
        
        // Verify DB persistence
        const { data: dbOrder } = await supabase
          .from('hc_clinical_orders')
          .select('*')
          .eq('id', result.data.id)
          .single();
        
        expect(dbOrder).toBeDefined();
        expect(dbOrder?.order_status).toBe('PENDING');
        
        // Verify event published
        const events = eventBus.getPublishedEvents();
        expect(events).toHaveLength(1);
        expect(events[0].eventType).toBe('OrderCreated');
      }
    });
    
    it('should enforce idempotency via requestId', async () => {
      const requestId = randomUUID();
      
      const request = {
        tenantId: fixtures.tenantId,
        encounterId: fixtures.encounterId,
        patientId: fixtures.patientPartyId,
        orderType: 'LAB' as const,
        priority: 'ROUTINE' as const,
        orderedBy: fixtures.providerPartyId,
        orderDetails: { test: 'CBC' },
        requestId,
      };
      
      // First request
      const result1 = await service.createOrder(request);
      expect(result1.success).toBe(true);
      expect(result1.data).toBeDefined();
      
      if (result1.data) {
        createdOrderIds.push(result1.data.id);
      }
      
      // Second request with same requestId
      const result2 = await service.createOrder(request);
      expect(result2.success).toBe(true);
      expect(result2.data).toBeDefined();
      expect(result2.data?.id).toBe(result1.data?.id);  // Same order
      
      // Verify only 1 order in DB
      const { data: orders } = await supabase
          .from('hc_clinical_orders')
          .select('*')
          .eq('tenant_id', fixtures.tenantId)
          .eq('request_id', requestId);
      
      expect(orders).toHaveLength(1);
      expect(orders![0].id).toBe(result1.data?.id);
      expect(orders![0].request_id).toBe(requestId);
      
      // Verify event was only published once
      const events = eventBus.getPublishedEvents();
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('OrderCreated');
    });
    
    it('should reject order if encounter not found', async () => {
      const request = {
        tenantId: fixtures.tenantId,
        encounterId: randomUUID(),  // Non-existent encounter
        patientId: fixtures.patientPartyId,
        orderType: 'MEDICATION' as const,
        priority: 'ROUTINE' as const,
        orderedBy: fixtures.providerPartyId,
        orderDetails: {},
      };
      
      const result = await service.createOrder(request);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
      expect(result.eventPublished).toBe(false);
    });
    
    it('should reject order if patient does not match encounter', async () => {
      const request = {
        tenantId: fixtures.tenantId,
        encounterId: fixtures.encounterId,
        patientId: randomUUID(),  // Wrong patient
        orderType: 'MEDICATION' as const,
        priority: 'ROUTINE' as const,
        orderedBy: fixtures.providerPartyId,
        orderDetails: {},
      };
      
      const result = await service.createOrder(request);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('does not belong to encounter');
      expect(result.eventPublished).toBe(false);
    });
    
    it('should reject order if encounter is discharged (FINISHED)', async () => {
      // Create separate fixture with FINISHED encounter
      finishedFixture = await HealthcareTestFixtures.setupFinishedEncounter();
      
      const request = {
        tenantId: finishedFixture.tenantId,
        encounterId: finishedFixture.encounterId,
        patientId: finishedFixture.patientPartyId,
        orderType: 'MEDICATION' as const,
        priority: 'ROUTINE' as const,
        orderedBy: finishedFixture.providerPartyId,
        orderDetails: {},
      };
      
      const result = await service.createOrder(request);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('does not allow new orders');
      expect(result.eventPublished).toBe(false);
    });
    
    it('should reject order if encounter is cancelled', async () => {
      // Create separate fixture with CANCELLED encounter
      cancelledFixture = await HealthcareTestFixtures.setupCancelledEncounter();
      
      const request = {
        tenantId: cancelledFixture.tenantId,
        encounterId: cancelledFixture.encounterId,
        patientId: cancelledFixture.patientPartyId,
        orderType: 'MEDICATION' as const,
        priority: 'ROUTINE' as const,
        orderedBy: cancelledFixture.providerPartyId,
        orderDetails: {},
      };
      
      const result = await service.createOrder(request);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('does not allow new orders');
      expect(result.eventPublished).toBe(false);
    });
  });
  
  describe('approveOrder - End-to-End', () => {
    it('should approve order + update DB + publish event', async () => {
      // Create order first
      const createRequest = {
        tenantId: fixtures.tenantId,
        encounterId: fixtures.encounterId,
        patientId: fixtures.patientPartyId,
        orderType: 'MEDICATION' as const,
        priority: 'ROUTINE' as const,
        orderedBy: fixtures.providerPartyId,
        orderDetails: {},
      };
      
      const createResult = await service.createOrder(createRequest);
      expect(createResult.success).toBe(true);
      
      if (!createResult.data) throw new Error('Order creation failed');
      createdOrderIds.push(createResult.data.id);
      
      // Transition order to VALIDATED in DB to satisfy domain validation rule
      const orderToApprove = await repository.findById(fixtures.tenantId, createResult.data.id);
      if (!orderToApprove) throw new Error('Order not found in DB');
      orderToApprove.validate('PASSED', 0);
      await repository.update(orderToApprove);
      
      eventBus.clear();
      
      // Approve order
      const approveRequest = {
        tenantId: fixtures.tenantId,
        orderId: createResult.data.id,
        approvedBy: fixtures.providerPartyId,
        expectedVersion: 2,
      };
      
      const result = await service.approveOrder(approveRequest);
      
      expect(result.success).toBe(true);
      expect(result.data?.orderStatus).toBe('APPROVED');
      expect(result.data?.version).toBe(3);
      expect(result.eventPublished).toBe(true);
      
      // Verify DB
      const { data: dbOrder } = await supabase
        .from('hc_clinical_orders')
        .select('order_status, version')
        .eq('id', createResult.data.id)
        .single();
      
      expect(dbOrder?.order_status).toBe('APPROVED');
      expect(dbOrder?.version).toBe(3);
      
      // Verify event
      const events = eventBus.getPublishedEvents();
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('OrderApproved');
    });
    
    it('should enforce optimistic locking (stale version)', async () => {
      // Create order
      const createRequest = {
        tenantId: fixtures.tenantId,
        encounterId: fixtures.encounterId,
        patientId: fixtures.patientPartyId,
        orderType: 'MEDICATION' as const,
        priority: 'ROUTINE' as const,
        orderedBy: fixtures.providerPartyId,
        orderDetails: {},
      };
      
      const createResult = await service.createOrder(createRequest);
      if (!createResult.data) throw new Error('Order creation failed');
      createdOrderIds.push(createResult.data.id);
      
      // Transition order to VALIDATED in DB to satisfy domain validation rule
      const orderToApprove = await repository.findById(fixtures.tenantId, createResult.data.id);
      if (!orderToApprove) throw new Error('Order not found in DB');
      orderToApprove.validate('PASSED', 0);
      await repository.update(orderToApprove);
      
      // Approve with stale version (actual version is 2)
      const approveRequest = {
        tenantId: fixtures.tenantId,
        orderId: createResult.data.id,
        approvedBy: fixtures.providerPartyId,
        expectedVersion: 1,  // Stale version
      };
      
      const result = await service.approveOrder(approveRequest);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('version mismatch');
    });
  });
  
  describe('discontinueOrder - End-to-End', () => {
    it('should discontinue order + update DB + publish event', async () => {
      // Create order
      const createRequest = {
        tenantId: fixtures.tenantId,
        encounterId: fixtures.encounterId,
        patientId: fixtures.patientPartyId,
        orderType: 'MEDICATION' as const,
        priority: 'ROUTINE' as const,
        orderedBy: fixtures.providerPartyId,
        orderDetails: {},
      };
      
      const createResult = await service.createOrder(createRequest);
      if (!createResult.data) throw new Error('Order creation failed');
      createdOrderIds.push(createResult.data.id);
      
      // Transition order to APPROVED in DB to satisfy domain rules for discontinuation
      const orderToDiscontinue = await repository.findById(fixtures.tenantId, createResult.data.id);
      if (!orderToDiscontinue) throw new Error('Order not found in DB');
      orderToDiscontinue.validate('PASSED', 0);
      orderToDiscontinue.approve(fixtures.providerPartyId);
      await repository.update(orderToDiscontinue);
      
      eventBus.clear();
      
      // Discontinue order
      const discontinueRequest = {
        tenantId: fixtures.tenantId,
        orderId: createResult.data.id,
        discontinuedBy: fixtures.providerPartyId,
        discontinueReason: 'Patient allergic to medication',
        expectedVersion: 3,
      };
      
      const result = await service.discontinueOrder(discontinueRequest);
      
      expect(result.success).toBe(true);
      expect(result.data?.orderStatus).toBe('DISCONTINUED');
      expect(result.data?.discontinueReason).toBe('Patient allergic to medication');
      expect(result.eventPublished).toBe(true);
      
      // Verify DB
      const { data: dbOrder } = await supabase
        .from('hc_clinical_orders')
        .select('order_status, discontinue_reason')
        .eq('id', createResult.data.id)
        .single();
      
      expect(dbOrder?.order_status).toBe('DISCONTINUED');
      expect(dbOrder?.discontinue_reason).toBe('Patient allergic to medication');
      
      // Verify event
      const events = eventBus.getPublishedEvents();
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('OrderDiscontinued');
    });
  });
  
  describe('Tenant Isolation', () => {
    it('should not allow creating order for different tenant encounter', async () => {
      const wrongTenantId = randomUUID();
      
      const request = {
        tenantId: wrongTenantId,  // Different tenant
        encounterId: fixtures.encounterId,
        patientId: fixtures.patientPartyId,
        orderType: 'MEDICATION' as const,
        priority: 'ROUTINE' as const,
        orderedBy: fixtures.providerPartyId,
        orderDetails: {},
      };
      
      const result = await service.createOrder(request);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');  // Encounter doesn't exist in wrong tenant
      expect(result.eventPublished).toBe(false);
    });
  });
});
