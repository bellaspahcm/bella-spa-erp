import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createClient } from '@/lib/supabase-server';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { getEncounterEngine, resetEncounterEngine, type IEncounterEngine } from '../engines/encounter-engine';
import { getClinicalOrderService, resetClinicalOrderService, ClinicalOrderService, ClinicalOrder } from '../engines/order-engine';
import { eventBus } from '@/platform/host/event-bus/event-bus.service';
import type { DomainEvent } from '@/platform/host/event-bus/types';
import { HealthcareTestFixtures, type HealthcareTestFixture } from './fixtures/healthcare-test-fixtures';
import { SupabaseOrderRepository } from '../engines/order-engine/repositories/supabase-order-repository';

describe('Encounter -> Order Cross-Engine Integration Tests (STEP 9)', () => {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let fixtures: HealthcareTestFixture;
  
  let encounterEngine: IEncounterEngine;
  let orderService: ClinicalOrderService;
  let orderRepository: SupabaseOrderRepository;
  
  let createdEncounterIds: string[] = [];
  let createdOrderIds: string[] = [];
  
  beforeEach(async () => {
    supabase = await createClient();
    fixtures = await HealthcareTestFixtures.setup();
    
    // Reset singletons to inject the fresh test client
    resetEncounterEngine();
    resetClinicalOrderService();
    
    encounterEngine = getEncounterEngine(supabase);
    orderService = getClinicalOrderService(supabase);
    orderRepository = new SupabaseOrderRepository(supabase);
  });
  
  afterEach(async () => {
    // Cleanup orders
    if (createdOrderIds.length > 0) {
      await supabase
        .from('hc_clinical_orders')
        .delete()
        .in('id', createdOrderIds);
      createdOrderIds = [];
    }
    
    // Cleanup encounters created by tests
    if (createdEncounterIds.length > 0) {
      await supabase
        .from('hc_encounters')
        .delete()
        .in('id', createdEncounterIds);
      createdEncounterIds = [];
    }
    
    // Cleanup fixtures
    await fixtures.cleanup();
  });
  
  // ==========================================================================
  // Group A: Cross-Engine Happy Paths
  // ==========================================================================
  
  it('should successfully create order for a real active encounter from Encounter Engine', async () => {
    // 1. Create encounter via Encounter Engine
    const encounterRes = await encounterEngine.createEncounter({
      tenantId: fixtures.tenantId,
      patientId: fixtures.patientPartyId,
      encounterClass: 'AMB',
      encounterType: 'outpatient',
      admittingProviderId: fixtures.providerPartyId,
      userId: fixtures.providerPartyId,
    });
    
    expect(encounterRes.success).toBe(true);
    const encounterId = encounterRes.encounter!.id;
    createdEncounterIds.push(encounterId);
    
    // 2. Transition status to arrived then in-progress (active) via Encounter Engine
    const arriveRes = await encounterEngine.updateStatus({
      tenantId: fixtures.tenantId,
      encounterId,
      status: 'arrived',
      userId: fixtures.providerPartyId,
    });
    expect(arriveRes.success).toBe(true);

    const statusRes = await encounterEngine.updateStatus({
      tenantId: fixtures.tenantId,
      encounterId,
      status: 'in-progress',
      userId: fixtures.providerPartyId,
    });
    expect(statusRes.success).toBe(true);
    
    // 3. Create clinical order via Order Service
    const orderRequest = {
      tenantId: fixtures.tenantId,
      encounterId,
      patientId: fixtures.patientPartyId,
      orderType: 'MEDICATION' as const,
      priority: 'ROUTINE' as const,
      orderedBy: fixtures.providerPartyId,
      orderDetails: { drug: 'Paracetamol 500mg' },
    };
    
    const result = await orderService.createOrder(orderRequest);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.orderStatus).toBe('PENDING');
    
    createdOrderIds.push(result.data!.id);
  });
  
  it('should successfully approve a validated clinical order linked to an active encounter', async () => {
    const encounterId = fixtures.encounterId; // in-progress
    
    // 1. Create clinical order
    const createResult = await orderService.createOrder({
      tenantId: fixtures.tenantId,
      encounterId,
      patientId: fixtures.patientPartyId,
      orderType: 'MEDICATION' as const,
      priority: 'ROUTINE' as const,
      orderedBy: fixtures.providerPartyId,
      orderDetails: { drug: 'Amoxicillin 500mg' },
    });
    expect(createResult.success).toBe(true);
    const orderId = createResult.data!.id;
    createdOrderIds.push(orderId);
    
    // 2. Transition order status from PENDING to VALIDATED in repository (simulating validation checks passed)
    const order = await orderRepository.findById(fixtures.tenantId, orderId);
    expect(order).not.toBeNull();
    order!.validate('PASSED', 0);
    await orderRepository.update(order!);
    
    // 3. Approve order via service
    const approveResult = await orderService.approveOrder({
      tenantId: fixtures.tenantId,
      orderId,
      approvedBy: fixtures.providerPartyId,
      expectedVersion: 2,
    });
    
    expect(approveResult.success).toBe(true);
    expect(approveResult.data?.orderStatus).toBe('APPROVED');
    expect(approveResult.data?.version).toBe(3);
  });

  it('should successfully discontinue an approved clinical order', async () => {
    const encounterId = fixtures.encounterId; // in-progress
    
    // 1. Create order
    const createResult = await orderService.createOrder({
      tenantId: fixtures.tenantId,
      encounterId,
      patientId: fixtures.patientPartyId,
      orderType: 'MEDICATION' as const,
      priority: 'ROUTINE' as const,
      orderedBy: fixtures.providerPartyId,
      orderDetails: { drug: 'Amoxicillin 500mg' },
    });
    const orderId = createResult.data!.id;
    createdOrderIds.push(orderId);
    
    // 2. Transition to APPROVED (PENDING -> VALIDATED -> APPROVED)
    const order = await orderRepository.findById(fixtures.tenantId, orderId);
    order!.validate('PASSED', 0);
    order!.approve(fixtures.providerPartyId);
    await orderRepository.update(order!);
    
    // 3. Discontinue
    const discontinueResult = await orderService.discontinueOrder({
      tenantId: fixtures.tenantId,
      orderId,
      discontinuedBy: fixtures.providerPartyId,
      discontinueReason: 'Medication allergic reaction detected',
      expectedVersion: 3,
    });
    
    expect(discontinueResult.success).toBe(true);
    expect(discontinueResult.data?.orderStatus).toBe('DISCONTINUED');
    expect(discontinueResult.data?.discontinueReason).toBe('Medication allergic reaction detected');
  });

  // ==========================================================================
  // Group B: Linkage and Identity Verification
  // ==========================================================================
  
  it('should reject order if patient ID does not match the encounter patient', async () => {
    const wrongPatientId = randomUUID();
    
    const request = {
      tenantId: fixtures.tenantId,
      encounterId: fixtures.encounterId,
      patientId: wrongPatientId, // Mismatch
      orderType: 'MEDICATION' as const,
      priority: 'ROUTINE' as const,
      orderedBy: fixtures.providerPartyId,
      orderDetails: {},
    };
    
    const result = await orderService.createOrder(request);
    expect(result.success).toBe(false);
    expect(result.error).toContain('does not belong to encounter');
  });
  
  it('should verify encounter and order properties match exactly on success', async () => {
    const createResult = await orderService.createOrder({
      tenantId: fixtures.tenantId,
      encounterId: fixtures.encounterId,
      patientId: fixtures.patientPartyId,
      orderType: 'LAB' as const,
      priority: 'ROUTINE' as const,
      orderedBy: fixtures.providerPartyId,
      orderDetails: { test: 'Blood Count' },
    });
    
    expect(createResult.success).toBe(true);
    const order = createResult.data!;
    createdOrderIds.push(order.id);
    
    // Fetch encounter details to verify
    const encRes = await encounterEngine.getEncounter({
      tenantId: fixtures.tenantId,
      encounterId: fixtures.encounterId,
    });
    expect(encRes.success).toBe(true);
    const encounter = encRes.encounter!;
    
    expect(order.tenantId).toBe(encounter.tenantId);
    expect(order.encounterId).toBe(encounter.id);
    expect(order.patientId).toBe(encounter.patientId);
  });

  // ==========================================================================
  // Group C: Tenant Boundaries
  // ==========================================================================
  
  it('should reject creating order if tenant IDs are mismatched', async () => {
    const otherTenantId = randomUUID();
    
    const request = {
      tenantId: otherTenantId, // Different tenant boundary
      encounterId: fixtures.encounterId,
      patientId: fixtures.patientPartyId,
      orderType: 'MEDICATION' as const,
      priority: 'ROUTINE' as const,
      orderedBy: fixtures.providerPartyId,
      orderDetails: {},
    };
    
    const result = await orderService.createOrder(request);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found'); // Cannot view encounter of tenant A from tenant B context
  });

  it('should block actions like approval if requested from a mismatched tenant context', async () => {
    const createResult = await orderService.createOrder({
      tenantId: fixtures.tenantId,
      encounterId: fixtures.encounterId,
      patientId: fixtures.patientPartyId,
      orderType: 'MEDICATION' as const,
      priority: 'ROUTINE' as const,
      orderedBy: fixtures.providerPartyId,
      orderDetails: {},
    });
    const orderId = createResult.data!.id;
    createdOrderIds.push(orderId);
    
    // Attempt approval with wrong tenant ID
    const wrongTenantId = randomUUID();
    const result = await orderService.approveOrder({
      tenantId: wrongTenantId,
      orderId,
      approvedBy: fixtures.providerPartyId,
      expectedVersion: 1,
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  // ==========================================================================
  // Group D: Encounter Lifecycle Boundaries
  // ==========================================================================
  
  it('should reject order if encounter is in PLANNED status', async () => {
    // 1. Create encounter (defaults to planned)
    const encounterRes = await encounterEngine.createEncounter({
      tenantId: fixtures.tenantId,
      patientId: fixtures.patientPartyId,
      admittingProviderId: fixtures.providerPartyId,
      userId: fixtures.providerPartyId,
    });
    const encounterId = encounterRes.encounter!.id;
    createdEncounterIds.push(encounterId);
    
    // 2. Attempt to create order
    const result = await orderService.createOrder({
      tenantId: fixtures.tenantId,
      encounterId,
      patientId: fixtures.patientPartyId,
      orderType: 'LAB' as const,
      priority: 'ROUTINE' as const,
      orderedBy: fixtures.providerPartyId,
      orderDetails: {},
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('does not allow new orders');
  });

  it('should reject order if encounter is in FINISHED status', async () => {
    // 1. Create encounter, transition to in-progress, then to finished
    const encounterRes = await encounterEngine.createEncounter({
      tenantId: fixtures.tenantId,
      patientId: fixtures.patientPartyId,
      userId: fixtures.providerPartyId,
    });
    const encounterId = encounterRes.encounter!.id;
    createdEncounterIds.push(encounterId);
    
    await encounterEngine.updateStatus({
      tenantId: fixtures.tenantId,
      encounterId,
      status: 'arrived',
      userId: fixtures.providerPartyId,
    });

    await encounterEngine.updateStatus({
      tenantId: fixtures.tenantId,
      encounterId,
      status: 'in-progress',
      userId: fixtures.providerPartyId,
    });
    
    await encounterEngine.updateStatus({
      tenantId: fixtures.tenantId,
      encounterId,
      status: 'finished',
      userId: fixtures.providerPartyId,
    });
    
    // 2. Attempt to create order
    const result = await orderService.createOrder({
      tenantId: fixtures.tenantId,
      encounterId,
      patientId: fixtures.patientPartyId,
      orderType: 'LAB' as const,
      priority: 'ROUTINE' as const,
      orderedBy: fixtures.providerPartyId,
      orderDetails: {},
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('does not allow new orders');
  });

  it('should reject order if encounter is in CANCELLED status', async () => {
    // 1. Create encounter, transition to in-progress, then to cancelled
    const encounterRes = await encounterEngine.createEncounter({
      tenantId: fixtures.tenantId,
      patientId: fixtures.patientPartyId,
      userId: fixtures.providerPartyId,
    });
    const encounterId = encounterRes.encounter!.id;
    createdEncounterIds.push(encounterId);
    
    await encounterEngine.updateStatus({
      tenantId: fixtures.tenantId,
      encounterId,
      status: 'arrived',
      userId: fixtures.providerPartyId,
    });

    await encounterEngine.updateStatus({
      tenantId: fixtures.tenantId,
      encounterId,
      status: 'in-progress',
      userId: fixtures.providerPartyId,
    });
    
    await encounterEngine.updateStatus({
      tenantId: fixtures.tenantId,
      encounterId,
      status: 'cancelled',
      reason: 'Patient did not attend appointment',
      userId: fixtures.providerPartyId,
    });
    
    // 2. Attempt to create order
    const result = await orderService.createOrder({
      tenantId: fixtures.tenantId,
      encounterId,
      patientId: fixtures.patientPartyId,
      orderType: 'LAB' as const,
      priority: 'ROUTINE' as const,
      orderedBy: fixtures.providerPartyId,
      orderDetails: {},
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('does not allow new orders');
  });

  // ==========================================================================
  // Group E: Event Propagation and Metadata Checks
  // ==========================================================================
  
  it('should translate and publish OrderCreated to the platform host event bus with exact metadata', async () => {
    const requestId = randomUUID();
    let publishedEvent: DomainEvent<Record<string, unknown>> | null = null;
    
    // 1. Subscribe to host event bus
    const unsubscribe = eventBus.subscribe<Record<string, unknown>>('hos.order.created.v1', (event) => {
      publishedEvent = event;
    });
    
    // 2. Create clinical order
    const result = await orderService.createOrder({
      tenantId: fixtures.tenantId,
      encounterId: fixtures.encounterId,
      patientId: fixtures.patientPartyId,
      orderType: 'LAB' as const,
      priority: 'ROUTINE' as const,
      orderedBy: fixtures.providerPartyId,
      orderDetails: { test: 'Urinalysis' },
      requestId,
    });
    expect(result.success).toBe(true);
    createdOrderIds.push(result.data!.id);
    
    // 3. Assert event was published correctly
    expect(publishedEvent).not.toBeNull();
    expect(publishedEvent?.eventType).toBe('hos.order.created.v1');
    expect(publishedEvent?.tenantId).toBe(fixtures.tenantId);
    expect(publishedEvent?.aggregateId).toBe(result.data!.id);
    expect(publishedEvent?.aggregateType).toBe('ClinicalOrder');
    
    expect(publishedEvent?.payload?.orderId).toBe(result.data!.id);
    expect(publishedEvent?.payload?.encounterId).toBe(fixtures.encounterId);
    expect(publishedEvent?.payload?.requestId).toBe(requestId);
    
    unsubscribe();
  });

  it('should publish OrderApproved events with status changes and versions', async () => {
    const orderId = randomUUID();
    
    // Seed order directly into DB at VALIDATED state
    const now = new Date().toISOString();
    await supabase.from('hc_clinical_orders').insert({
      id: orderId,
      tenant_id: fixtures.tenantId,
      encounter_id: fixtures.encounterId,
      patient_party_id: fixtures.patientPartyId,
      order_type: 'LAB',
      order_status: 'VALIDATED',
      priority: 'ROUTINE',
      ordered_by: fixtures.providerPartyId,
      ordered_at: now,
      version: 2,
    });
    createdOrderIds.push(orderId);

    let approvedEvent: DomainEvent<Record<string, unknown>> | null = null;
    const unsubscribe = eventBus.subscribe<Record<string, unknown>>('hos.order.approved.v1', (event) => {
      approvedEvent = event;
    });
    
    // Call approve
    await orderService.approveOrder({
      tenantId: fixtures.tenantId,
      orderId,
      approvedBy: fixtures.providerPartyId,
      expectedVersion: 2,
    });
    
    expect(approvedEvent).not.toBeNull();
    expect(approvedEvent?.eventType).toBe('hos.order.approved.v1');
    expect(approvedEvent?.payload?.orderId).toBe(orderId);
    expect(approvedEvent?.payload?.approvedBy).toBe(fixtures.providerPartyId);
    expect(approvedEvent?.payload?.previousStatus).toBe('VALIDATED');
    expect(approvedEvent?.payload?.newStatus).toBe('APPROVED');
    
    unsubscribe();
  });

  // ==========================================================================
  // Group F: Failure and Atomicity Paths
  // ==========================================================================
  
  it('should propagate EncounterNotFoundError and publish zero events when encounter does not exist', async () => {
    const nonExistentId = randomUUID();
    let publishedEvent: DomainEvent | null = null;
    
    const unsubscribe = eventBus.subscribe('hos.order.created.v1', (event) => {
      publishedEvent = event;
    });
    
    const result = await orderService.createOrder({
      tenantId: fixtures.tenantId,
      encounterId: nonExistentId,
      patientId: fixtures.patientPartyId,
      orderType: 'LAB' as const,
      priority: 'ROUTINE' as const,
      orderedBy: fixtures.providerPartyId,
      orderDetails: {},
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
    expect(publishedEvent).toBeNull();
    
    unsubscribe();
  });

  it('should enforce optimistic locking on concurrent approval conflicts', async () => {
    const orderId = randomUUID();
    
    // Seed order in DB
    const now = new Date().toISOString();
    await supabase.from('hc_clinical_orders').insert({
      id: orderId,
      tenant_id: fixtures.tenantId,
      encounter_id: fixtures.encounterId,
      patient_party_id: fixtures.patientPartyId,
      order_type: 'LAB',
      order_status: 'VALIDATED',
      priority: 'ROUTINE',
      ordered_by: fixtures.providerPartyId,
      ordered_at: now,
      version: 2,
    });
    createdOrderIds.push(orderId);

    // Call approve with stale version 1 instead of 2
    const result = await orderService.approveOrder({
      tenantId: fixtures.tenantId,
      orderId,
      approvedBy: fixtures.providerPartyId,
      expectedVersion: 1, // Stale
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('version mismatch');
  });

  // ==========================================================================
  // Group G: Architectural Dependency Isolation (ADR-011)
  // ==========================================================================
  
  it('should verify Encounter Engine is 100% independent of Order Engine (unidirectional dependency)', () => {
    const encounterEngineDir = path.resolve(__dirname, '../engines/encounter-engine');
    
    // Helper to scan directory recursively
    const scanDir = (dir: string): string[] => {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      list.forEach((file) => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          results = results.concat(scanDir(fullPath));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          results.push(fullPath);
        }
      });
      return results;
    };
    
    const files = scanDir(encounterEngineDir);
    expect(files.length).toBeGreaterThan(0);
    
    files.forEach((filePath) => {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Ensure no imports reference 'order-engine' or '../../order-engine'
      const hasOrderEngineRef = content.includes('order-engine');
      if (hasOrderEngineRef) {
        console.error(`Dependency Violation in: ${filePath}`);
      }
      expect(hasOrderEngineRef).toBe(false);
    });
  });
});
